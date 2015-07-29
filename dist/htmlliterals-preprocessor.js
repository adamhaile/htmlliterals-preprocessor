(function (package) {
    // nano-implementation of require.js-like define(name, deps, impl) for internal use
    var definitions = {},
        publish = {};

    package(function define(name, deps, fn) {
        if (definitions.hasOwnProperty(name)) throw new Error("define: cannot redefine module " + name);
        definitions[name] = fn.apply(null, deps.map(function (dep) {
            if (!definitions.hasOwnProperty(dep)) throw new Error("define: module " + dep + " required by " + name + " has not been defined.");
            return definitions[dep];
        }));
    });

    if (typeof exports === 'object') publish = exports; // CommonJS
    else if (typeof define === 'function') define([], function () { return publish; }); // AMD
    else publish = this.htmlliterals = this.htmlliterals || publish; // fallback to global object

    publish.preprocess = definitions.preprocess;

})(function (define) {
    "use strict";

define('sourcemap', [], function () {
    var rx = {
            locs: /(\n)|(\u0000(\d+),(\d+)\u0000)|(\u0000\u0000)/g
        },
        vlqlast = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef",
        vlqcont = "ghijklmnopqrstuvwxyz0123456789+/";

    return {
        segmentStart: segmentStart,
        segmentEnd:   segmentEnd,
        extractMap:   extractMap,
        appendMap:    appendMap
    };

    function segmentStart(loc) {
        return "\u0000" + loc.line + "," + loc.col + "\u0000";
    }

    function segmentEnd() {
        return "\u0000\u0000";
    }

    function extractMappings(embedded) {
        var mappings = "",
            pgcol = 0,
            psline = 0,
            pscol = 0,
            insegment = false,
            linestart = 0,
            linecont = false;

        var src = embedded.replace(rx.locs, function (_, nl, start, line, col, end, offset) {
            if (nl) {
                mappings += ";";

                if (insegment) {
                    mappings += "AA" + vlq(1) + vlq(0 - pscol);
                    psline++;
                    pscol = 0;
                    linecont = true;
                } else {
                    linecont = false;
                }

                linestart = offset + nl.length;

                pgcol = 0;

                return nl;
            } else if (start) {
                var gcol = offset - linestart;
                line = parseInt(line);
                col = parseInt(col);

                mappings += (linecont ? "," : "")
                          + vlq(gcol - pgcol)
                          + "A" // only one file
                          + vlq(line - psline)
                          + vlq(col - pscol);

                insegment = true;
                linecont = true;

                pgcol = gcol;
                psline = line;
                pscol = col;

                return "";
            } else if (end) {
                insegment = false;
                return "";
            }
        });

        return {
            src: src,
            mappings: mappings
        };
    }

    function extractMap(src, original, opts) {
        var extract = extractMappings(src),
            map = createMap(extract.mappings, original);

        return {
            src: extract.src,
            map: map
        };
    }

    function createMap(mappings, original) {
        return {
            version       : 3,
            file          : 'out.js',
            sources       : [ 'in.js' ],
            sourcesContent: [ original ],
            names         : [],
            mappings      : mappings
        };
    }

    function appendMap(src, original, opts) {
        var extract = extractMap(src, original),
            appended = extract.src
              + "\n//# sourceMappingURL=data:"
              + escape(JSON.stringify(extract.map));

        return appended;
    }

    function vlq(num) {
        var str = "", i;

        // convert num sign representation from 2s complement to sign bit in lsd
        num = num < 0 ? (-num << 1) + 1 : num << 1 + 0;
        // convert num to base 32 number
        num = num.toString(32);

        // convert base32 digits of num to vlq continuation digits in reverse order
        for (i = num.length - 1; i > 0; i--)
            str += vlqcont[parseInt(num[i], 32)];

        // add final vlqlast digit
        str += vlqlast[parseInt(num[0], 32)];

        return str;
    }
});

define('tokenize', [], function () {
    /// tokens:
    /// < (followed by \w)
    /// </ (followed by \w))
    /// >
    /// />
    /// <!--
    /// -->
    /// @
    /// =
    /// )
    /// (
    /// [
    /// ]
    /// {
    /// }
    /// "
    /// '
    /// //
    /// \n
    /// /*
    /// */
    /// misc (any string not containing one of the above)

    // pre-compiled regular expressions
    var rx = {
        tokens: /<\/?(?=\w)|\/?>|<!--|-->|@|=|\)|\(|\[|\]|\{|\}|"|'|\/\/|\n|\/\*|\*\/|(?:[^<>@=\/@=()[\]{}"'\n*-]|(?!-->)-|\/(?![>/*])|\*(?!\/)|(?!<\/?\w|<!--)<\/?)+/g,
    };

    return function tokenize(str, opts) {
        var toks = str.match(rx.tokens);

        return toks;
        //return TokenStream(toks);
    }
});

define('AST', [], function () {
    return {
        CodeTopLevel: function (segments) {
            this.segments = segments; // [ CodeText | HtmlLiteral ]
        },
        CodeText: function (text, loc) {
            this.text = text; // string
            this.loc = loc; // { line: int, col: int }
        },
        EmbeddedCode: function (segments) {
            this.segments = segments; // [ CodeText | HtmlLiteral ]
        },
        HtmlLiteral: function(nodes) {
            this.nodes = nodes; // [ HtmlElement | HtmlComment | HtmlText(ws only) | HtmlInsert ]
        },
        HtmlElement: function(beginTag, properties, directives, content, endTag) {
            this.beginTag = beginTag; // string
            this.properties = properties; // [ Property ]
            this.directives = directives; // [ Directive | AttrStyleDirective ]
            this.content = content; // [ HtmlElement | HtmlComment | HtmlText | HtmlInsert ]
            this.endTag = endTag; // string | null
        },
        HtmlText: function (text) {
            this.text = text; // string
        },
        HtmlComment: function (text) {
            this.text = text; // string
        },
        HtmlInsert: function (code) {
            this.code = code; // EmbeddedCode
        },
        Property: function (name, code, callback) {
            this.name = name; // string
            this.code = code; // EmbeddedCode
            this.callback = callback; // bool
        },
        Directive: function (name, code) {
            this.name = name; // string
            this.code = code; // EmbeddedCode
        },
        AttrStyleDirective: function (name, params, code, callback) {
            this.name = name; // string
            this.params = params; // [ string ]
            this.code = code; // EmbeddedCode
            this.callback = callback; // bool
        }
    };
});

define('parse', ['AST'], function (AST) {

    // pre-compiled regular expressions
    var rx = {
        propertyLeftSide   : /\s(\S+)\s*=>?\s*$/,
        directiveName      : /^[a-zA-Z_$][a-zA-Z_$0-9]*(:[^\s:=]*)*/, // like "foo:bar:blech"
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
                directives = [],
                content = [],
                endTag = "",
                hasContent = true;

            beginTag += TOK, NEXT();

            // scan for attributes until end of opening tag
            while (!EOF && NOT('>') && NOT('/>')) {
                if (IS('@')) {
                    directives.push(directive());
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

                if (EOF) ERR("element missing close tag");

                while (!EOF && NOT('>')) {
                    endTag += TOK, NEXT();
                }

                if (EOF) ERR("eof while looking for element close tag");

                endTag += TOK, NEXT();
            }

            return new AST.HtmlElement(beginTag, properties, directives, content, endTag);
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

            var text = "";

            while (!EOF && NOT('-->')) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated html comment");

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
                name,
                callback = false;

            beginTag += TOK, NEXT();

            if (IS('>')) callback = true, beginTag += TOK, NEXT();

            if (WS()) beginTag += TOK, NEXT();

            match = rx.propertyLeftSide.exec(beginTag);

            // check if it's an attribute not a property assignment
            if (match && (callback || (NOT('"') && NOT("'")))) {
                beginTag = beginTag.substring(0, beginTag.length - match[0].length);

                name = match[1];

                SPLIT(rx.leadingWs);

                properties.push(new AST.Property(name, embeddedCode(), callback));
            }

            return beginTag;
        }

        function directive() {
            if (NOT('@')) ERR("not at start of directive");

            NEXT();

            var name = SPLIT(rx.directiveName),
                text,
                segments,
                loc,
                callback = false;

            if (!name) ERR("directive must have name");

            if (IS('(')) {
                segments = [];
                loc = LOC();
                text = balancedParens(segments, "", loc);
                if (text) segments.push(new AST.CodeText(text, loc));

                return new AST.Directive(name, new AST.EmbeddedCode(segments));
            } else {
                if (WS()) NEXT();

                if (NOT('=')) ERR("unrecognized directive - must have form like @foo:bar = ... or @foo( ... )");

                NEXT();

                if (IS('>')) callback = true, NEXT();

                SPLIT(rx.leadingWs);

                name = name.split(":");

                return new AST.AttrStyleDirective(name[0], name.slice(1), embeddedCode(), callback);
            }
        }

        function embeddedCode() {
            var start = LOC(),
                segments = [],
                text = "",
                part,
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
            var end = PARENS();

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

            if (EOF) ERR("unterminated parentheses");

            text += TOK, NEXT();

            return text;
        }

        function quotedString() {
            if (NOT("'") && NOT('"')) ERR("not in quoted string");

            var quote,
                text;

            quote = text = TOK, NEXT();

            while (!EOF && (NOT(quote) || rx.stringEscapedEnd.test(text))) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated string");

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

            var text = "";

            while (!EOF && NOT('*/')) {
                text += TOK, NEXT();
            }

            if (EOF) ERR("unterminated multi-line comment");

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
            var frag = loc ? " at line " + loc.line + " col " + loc.col + ": ``" + TOKS.join('').substr(loc.pos, 30).replace("\n", "") + "''" : "";
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
    }
});

define('genCode', ['AST', 'sourcemap'], function (AST, sourcemap) {

    // pre-compiled regular expressions
    var rx = {
        eventProperty      : /^on/,
        backslashes        : /\\/g,
        newlines           : /\n/g,
        singleQuotes       : /'/g,
        firstline          : /^[^\n]*/,
        lastline           : /[^\n]*$/,
        nonws              : /\S/g
    };

    // genCode
    AST.CodeTopLevel.prototype.genCode   =
    AST.EmbeddedCode.prototype.genCode   = function (opts) { return concatResults(opts, this.segments, 'genCode'); };
    AST.CodeText.prototype.genCode       = function (opts) {
        return (opts.sourcemap ? sourcemap.segmentStart(this.loc) : "")
            + this.text
            + (opts.sourcemap ? sourcemap.segmentEnd() : "");
    };
    var htmlLiteralId = 0; //Math.floor(Math.random() * Math.pow(2, 31));
    AST.HtmlLiteral.prototype.genCode = function (opts, prior) {
        var html = concatResults(opts, this.nodes, 'genHtml'),
            nl = "\n" + indent(prior),
            directives = this.nodes.length > 1 ? genChildDirectives(opts, this.nodes, nl) : this.nodes[0].genDirectives(opts, nl),
            code = "new " + opts.symbol + "(" + htmlLiteralId++ + "," + nl + codeStr(html) + ")";

        if (directives) code += nl + directives + nl;

        code = "(" + code + ".node)";

        return code;
    };

    // genHtml
    AST.HtmlElement.prototype.genHtml = function(opts) {
        return this.beginTag + concatResults(opts, this.content, 'genHtml') + (this.endTag || "");
    };
    AST.HtmlComment.prototype.genHtml =
    AST.HtmlText.prototype.genHtml    = function (opts) { return this.text; };
    AST.HtmlInsert.prototype.genHtml  = function (opts) { return '<!-- insert -->'; };

    // genDirectives
    AST.HtmlElement.prototype.genDirectives = function (opts, nl) {
        var childDirectives = genChildDirectives(opts, this.content, nl),
            properties = concatResults(opts, this.properties, 'genDirective', nl),
            directives = concatResults(opts, this.directives, 'genDirective', nl);

        //return properties + (properties && (directives || childDirectives) ? nl : "")
        //    + directives + (directives && childDirectives ? nl : "")
        //    + childDirectives;
        return childDirectives + (childDirectives && (properties || directives) ? nl : "")
            + properties + (properties && directives ? nl : "")
            + directives;
    };
    AST.HtmlComment.prototype.genDirectives =
    AST.HtmlText.prototype.genDirectives    = function (opts, nl) { return null; };
    AST.HtmlInsert.prototype.genDirectives  = function (opts, nl) {
        return new AST.AttrStyleDirective('insert', [], this.code, false).genDirective(opts);
    }

    // genDirective
    AST.Property.prototype.genDirective = function (opts) {
        var code = this.code.genCode(opts);
        if (this.callback) code = genCallback(this.name, code);
        return ".property(function (__) { __." + this.name + " = " + code + "; })";
    };
    AST.Directive.prototype.genDirective = function (opts) {
        return "." + this.name + "(function (__) { __" + this.code.genCode(opts) + "; })";
    };
    AST.AttrStyleDirective.prototype.genDirective = function (opts) {
        var code = "." + this.name + "(function (__) { __(";

        for (var i = 0; i < this.params.length; i++)
            code += codeStr(this.params[i]) + ", ";

        code += this.callback ? genCallback(this.name, this.code.genCode(opts))
                              : this.code.genCode(opts);

        code += "); })";

        return code;
    };

    function genChildDirectives(opts, childNodes, nl) {
        var indices = [],
            directives = [],
            identifiers = [],
            cnl = nl + "    ",
            ccnl = cnl + "     ",
            directive,
            i,
            result = "";

        for (i = 0; i < childNodes.length; i++) {
            directive = childNodes[i].genDirectives(opts, ccnl);
            if (directive) {
                indices.push(i);
                identifiers.push(childIdentifier(childNodes[i]));
                directives.push(directive);
            }
        }

        if (indices.length) {
            result += ".child([" + indices.join(", ") + "], function (__) {" + cnl;
            for (i = 0; i < directives.length; i++) {
                if (i) result += cnl;
                result += "// " + identifiers[i] + cnl;
                result += "__[" + i + "]" + directives[i] + ";"
            }
            result += nl + "})";
        }

        return result;
    }

    function concatResults(opts, children, method, sep) {
        var result = "", i;

        for (i = 0; i < children.length; i++) {
            if (i && sep) result += sep;
            result += children[i][method](opts, result);
        }

        return result;
    }

    function codeStr(str) {
        return "'" + str.replace(rx.backslashes, "\\\\")
                        .replace(rx.singleQuotes, "\\'")
                        .replace(rx.newlines, "\\\n")
                   + "'";
    }

    function genCallback(name, code) {
        var param = rx.eventProperty.test(name) ? name.substring(2) : "__";
        return "function (" + param + ") { " + code + " }";
    }

    function indent(prior) {
        var lastline = rx.lastline.exec(prior);
        lastline = lastline ? lastline[0] : '';
        return lastline.replace(rx.nonws, " ");
    }

    function childIdentifier(child) {
        return firstline(child.beginTag || child.text || child.genHtml());
    }

    function firstline(str) {
        var l = rx.firstline.exec(str);
        return l ? l[0] : '';
    }
});

// Cross-browser compatibility shims
define('shims', ['AST'], function (AST) {

    // can only probe for shims if we're running in a browser
    if (!this || !this.document) return false;

    var shimmed = false;

    // add base shim methods that visit AST
    AST.CodeTopLevel.prototype.shim = function (ctx) { shimSiblings(this, this.segments, ctx); };
    AST.HtmlLiteral.prototype.shim  = function (ctx) { shimSiblings(this, this.nodes, ctx); };
    AST.HtmlElement.prototype.shim  = function (ctx) { shimSiblings(this, this.content, ctx); };
    AST.HtmlInsert.prototype.shim   = function (ctx) { shimSiblings(this, this.segments, ctx) };
    AST.CodeText.prototype.shim     =
    AST.HtmlText.prototype.shim     =
    AST.HtmlComment.prototype.shim  = function (ctx) {};

    if (!browserPreservesWhitespaceTextNodes())
        addFEFFtoWhitespaceTextNodes();

    if (!browserPreservesInitialComments())
        insertTextNodeBeforeInitialComments();

    return shimmed;

    // IE <9 will removes text nodes that just contain whitespace in certain situations.
    // Solution is to add a zero-width non-breaking space (entity &#xfeff) to the nodes.
    function browserPreservesWhitespaceTextNodes() {
        var ul = document.createElement("ul");
        ul.innerHTML = "    <li></li>";
        return ul.childNodes.length === 2;
    }

    function addFEFFtoWhitespaceTextNodes() {
        shim(AST.HtmlText, function (ctx) {
            if (ws.test(this.text) && !(ctx.parent instanceof AST.HtmlAttr)) {
                this.text = '&#xfeff;' + this.text;
            }
        });
    }

    // IE <9 will remove comments when they're the first child of certain elements
    // Solution is to prepend a non-whitespace text node, using the &#xfeff trick.
    function browserPreservesInitialComments() {
        var ul = document.createElement("ul");
        ul.innerHTML = "<!-- --><li></li>";
        return ul.childNodes.length === 2;
    }

    function insertTextNodeBeforeInitialComments() {
        shim(AST.HtmlComment, function (ctx) {
            if (ctx.index === 0) {
                insertBefore(new AST.HtmlText('&#xfeff;'), ctx);
            }
        })
    }

    function shimSiblings(parent, siblings, prevCtx) {
        var ctx = { index: 0, parent: parent, sibings: siblings }
        for (; ctx.index < siblings.length; ctx.index++) {
            siblings[ctx.index].shim(ctx);
        }
    }

    function shim(node, fn) {
        shimmed = true;
        var oldShim = node.prototype.shim;
        node.prototype.shim = function (ctx) { fn.call(this, ctx); oldShim.call(this, ctx); };
    }

    function insertBefore(node, ctx) {
        ctx.siblings.splice(ctx.index, 0, node);
        node.shim(ctx);
        ctx.index++;
    }

    function insertAfter(node, ctx) {
        ctx.siblings.splice(ctx.index + 1, 0, node);
    }

});

define('preprocess', ['tokenize', 'parse', 'shims', 'sourcemap'], function (tokenize, parse, shimmed, sourcemap) {
    return function preprocess(str, opts) {
        opts = opts || {};
        opts.symbol = opts.symbol || 'Html';
        opts.sourcemap = opts.sourcemap || null;

        var toks = tokenize(str, opts),
            ast = parse(toks, opts);

        if (shimmed) ast.shim();

        var code = ast.genCode(opts),
            out;

        if (opts.sourcemap === 'extract') out = sourcemap.extractMap(code, str, opts);
        else if (opts.sourcemap === 'append') out = sourcemap.appendMap(code, str, opts);
        else out = code;

        return out;
    }
});

});
