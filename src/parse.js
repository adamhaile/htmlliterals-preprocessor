define('parse', ['AST'], function (AST) {

    // pre-compiled regular expressions
    var rx = {
        propertyLeftSide   : /\s(\S+)\s*=\s*$/,
        stringEscapedEnd   : /[^\\](\\\\)*\\$/, // ending in odd number of escape slashes = next char of string escaped
        ws                 : /^\s*$/,
        leadingWs          : /^\s+/,
        codeTerminator     : /^[\s<>/,;)\]}]/,
        codeContinuation   : /^[^\s<>/,;)\]}]+/,
        tagTrailingWs      : /\s+(?=\/?>$)/,
        emptyLines         : /\n\s+(?=\n)/g
    };

    var parens = {
        "(": ")",
        "[": "]",
        "{": "}"
    };

    return function parse(TOKS, opts) {
        var i = 0,
            EOF = TOKS.length === 0,
            TOK = !EOF && TOKS[i],
            LINE = 0,
            COL = 0,
            POS = 0;

        return codeTopLevel();

        function codeTopLevel() {
            var segments = [],
                text = "",
                loc = LOC();

            while (!EOF) {
                if (IS('<') || IS('<!--') || IS('@')) {
                    if (text) segments.push(new AST.CodeText(text, loc));
                    text = "";
                    segments.push(htmlLiteral());
                    loc = LOC();
                } else if (IS('"') || IS("'")) {
                    text += quotedString();
                } else if (IS('//')) {
                    text += codeSingleLineComment();
                } else if (IS('/*')) {
                    text += codeMultiLineComment();
                } else {
                    text += TOK, NEXT();
                }
            }

            if (text) segments.push(new AST.CodeText(text, loc));

            return new AST.CodeTopLevel(segments);
        }

        function htmlLiteral() {
            if (NOT('<') && NOT('<!--') && NOT('@')) ERR("not at start of html expression");

            var nodes = [],
                mark,
                wsText;

            while (!EOF) {
                if (IS('<')) {
                    nodes.push(htmlElement());
                } else if (IS('<!--')) {
                    nodes.push(htmlComment());
                } else if (IS('@')) {
                    nodes.push(htmlInsert());
                } else {
                    // look ahead to see if coming text is whitespace followed by another node
                    mark = MARK();
                    wsText = htmlWhitespaceText();

                    if (!EOF && (IS('<') || IS('<!--') || IS('@'))) {
                        nodes.push(wsText);
                    } else {
                        ROLLBACK(mark);
                        break;
                    }
                }
            }

            return new AST.HtmlLiteral(nodes);
        }

        function htmlElement() {
            if (NOT('<')) ERR("not at start of html element");

            var start = LOC(),
                beginTag = "",
                properties = [],
                mixins = [],
                content = [],
                endTag = "",
                hasContent = true;

            beginTag += TOK, NEXT();

            // scan for attributes until end of opening tag
            while (!EOF && NOT('>') && NOT('/>')) {
                if (IS('@')) {
                    mixins.push(mixin());
                } else if (IS('=')) {
                    beginTag = property(beginTag, properties);
                } else {
                    beginTag += TOK, NEXT();
                }
            }

            if (EOF) ERR("unterminated start node", start);

            hasContent = IS('>');

            beginTag += TOK, NEXT();

            // clean up extra whitespace now that directives have been removed
            beginTag = beginTag.replace(rx.tagTrailingWs, "").replace(rx.emptyLines, "");

            if (hasContent) {
                while (!EOF && NOT('</')) {
                    if (IS('<')) {
                        content.push(htmlElement());
                    } else if (IS('@')) {
                        content.push(htmlInsert());
                    } else if (IS('<!--')) {
                        content.push(htmlComment());
                    } else {
                        content.push(htmlText());
                    }
                }

                if (EOF) ERR("element missing close tag", start);

                while (!EOF && NOT('>')) {
                    endTag += TOK, NEXT();
                }

                if (EOF) ERR("eof while looking for end of element close tag", start);

                endTag += TOK, NEXT();
            }

            return new AST.HtmlElement(beginTag, properties, mixins, content, endTag);
        }

        function htmlText() {
            var text = "";

            while (!EOF && NOT('<') && NOT('<!--') && NOT('@') && NOT('</')) {
                text += TOK, NEXT();
            }

            return new AST.HtmlText(text);
        }

        function htmlWhitespaceText() {
            var text = "";

            while (!EOF && WS()) {
                text += TOK, NEXT();
            }

            return new AST.HtmlText(text);
        }

        function htmlComment() {
            if (NOT('<!--')) ERR("not in HTML comment");

            var start = LOC(),
                text = "";

            while (!EOF && NOT('-->')) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated html comment", start);

            text += TOK, NEXT();

            return new AST.HtmlComment(text);
        }

        function htmlInsert() {
            if (NOT('@')) ERR("not at start of code insert");

            NEXT();

            return new AST.HtmlInsert(embeddedCode());
        }

        function property(beginTag, properties) {
            if(NOT('=')) ERR("not at equals sign of a property assignment");

            var match,
                name;

            beginTag += TOK, NEXT();

            if (WS()) beginTag += TOK, NEXT();

            match = rx.propertyLeftSide.exec(beginTag);

            // check if it's an attribute not a property assignment
            if (match) {
                if (IS('"') || IS("'")) {
                    beginTag += quotedString();
                } else {
                    beginTag = beginTag.substring(0, beginTag.length - match[0].length);

                    name = match[1];

                    SPLIT(rx.leadingWs);

                    properties.push(new AST.Property(name, embeddedCode()));
                }
            }

            return beginTag;
        }

        function mixin() {
            if (NOT('@')) ERR("not at start of mixin");

            NEXT();

            return new AST.Mixin(embeddedCode());
        }

        function embeddedCode() {
            var start = LOC(),
                segments = [],
                text = "",
                loc = LOC();

            // consume source text up to the first top-level terminating character
            while(!EOF && !MATCH(rx.codeTerminator)) {
                if (PARENS()) {
                    text = balancedParens(segments, text, loc);
                } else if (IS("'") || IS('"')) {
                    text += quotedString();
                } else {
                    text += SPLIT(rx.codeContinuation);
                }
            }

            if (text) segments.push(new AST.CodeText(text, loc));

            if (segments.length === 0) ERR("not in embedded code", start);

            return new AST.EmbeddedCode(segments);
        }

        function balancedParens(segments, text, loc) {
            var start = LOC(),
                end = PARENS();

            if (end === undefined) ERR("not in parentheses");

            text += TOK, NEXT();

            while (!EOF && NOT(end)) {
                if (IS("'") || IS('"')) {
                    text += quotedString();
                } else if (IS('//')) {
                    text += codeSingleLineComment();
                } else if (IS('/*')) {
                    text += codeMultiLineComment();
                } else if (IS("<") || IS('<!--') || IS('@')) {
                    if (text) segments.push(new AST.CodeText(text, { line: loc.line, col: loc.col }));
                    text = "";
                    segments.push(htmlLiteral());
                    loc.line = LINE;
                    loc.col = COL;
                } else if (PARENS()) {
                    text = balancedParens(segments, text, loc);
                } else {
                    text += TOK, NEXT();
                }
            }

            if (EOF) ERR("unterminated parentheses", start);

            text += TOK, NEXT();

            return text;
        }

        function quotedString() {
            if (NOT("'") && NOT('"')) ERR("not in quoted string");

            var start = LOC(),
                quote,
                text;

            quote = text = TOK, NEXT();

            while (!EOF && (NOT(quote) || rx.stringEscapedEnd.test(text))) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated string", start);

            text += TOK, NEXT();

            return text;
        }

        function codeSingleLineComment() {
            if (NOT("//")) ERR("not in code comment");

            var text = "";

            while (!EOF && NOT('\n')) {
                text += TOK, NEXT();
            }

            // EOF within a code comment is ok, just means that the text ended with a comment
            if (!EOF) text += TOK, NEXT();

            return text;
        }

        function codeMultiLineComment() {
            if (NOT("/*")) ERR("not in code comment");

            var start = LOC(),
                text = "";

            while (!EOF && NOT('*/')) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated multi-line comment", start);

            text += TOK, NEXT();

            return text;
        }

        // token stream ops
        function NEXT() {
            if (TOK === "\n") LINE++, COL = 0, POS++;
            else if (TOK) COL += TOK.length, POS += TOK.length;

            if (++i >= TOKS.length) EOF = true, TOK = null;
            else TOK = TOKS[i];
        }

        function ERR(msg, loc) {
            loc = loc || LOC();
            var frag = " at line " + loc.line + " col " + loc.col + ": ``" + TOKS.join('').substr(loc.pos, 30).replace("\n", "").replace("\r", "") + "''";
            throw new Error(msg + frag);
        }

        function IS(t) {
            return TOK === t;
        }

        function NOT(t) {
            return TOK !== t;
        }

        function MATCH(rx) {
            return rx.test(TOK);
        }

        function MATCHES(rx) {
            return rx.exec(TOK);
        }

        function WS() {
            return !!MATCH(rx.ws);
        }

        function PARENS() {
            return parens[TOK];
        }

        function SPLIT(rx) {
            var m = MATCHES(rx);
            if (m && (m = m[0])) {
                COL += m.length;
                POS += m.length;
                TOK = TOK.substring(m.length);
                if (TOK === "") NEXT();
                return m;
            } else {
                return null;
            }
        }

        function LOC() {
            return { line: LINE, col: COL, pos: POS };
        }

        function MARK() {
            return {
                TOK: TOK,
                i:   i,
                EOF: EOF,
                LINE: LINE,
                COL: COL
            };
        }

        function ROLLBACK(mark) {
            TOK = mark.TOK;
            i   = mark.i;
            EOF = mark.EOF;
            LINE = mark.LINE;
            COL = mark.COL;
        }
    };
});
