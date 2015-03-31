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

    function TokenStream(toks) {
        var i       = 0,
            eof     = toks.length === 0,
            tok     = !eof && toks[i],
            line    = 0,
            col     = 0;

        return {
            TOK:      function TOK() { return TOK; },
            EOF:      function EOF() { return EOF; },
            NEXT:     NEXT,
            ERR:      ERR,
            IS:       IS,
            NOT:      NOT,
            MATCH:    MATCH,
            WS:       WS,
            SPLIT:    SPLIT,
            LOC:      LOC,
            MARK:     MARK,
            ROLLBACK: ROLLBACK
        };

        // token stream ops
        function NEXT() {
            if (tok === "\n") line++, col = 0;
            else if (tok) col += tok.length;

            if (++i >= toks.length) eof = true, tok = null;
            else tok = toks[i];
        }

        function ERR(msg) {
            throw new Error(msg);
        }

        function IS(t) {
            return tok === t;
        }

        function NOT(t) {
            return tok !== t;
        }

        function MATCH(rx) {
            return rx.test(tok);
        }

        function WS() {
            return !!MATCH(rx.ws);
        }

        function SPLIT(rx) {
            var m = rx.exec(tok);
            if (m && (m = m[0])) {
                col += m.length;
                tok = tok.substring(m.length);
                if (tok === "") NEXT();
                return m;
            } else {
                return null;
            }
        }

        function LOC() {
            return { line: line, col: col };
        }

        function MARK() {
            return {
                tok:     tok,
                i:       i,
                eof:     eof,
                line:    line,
                col:     col,
                segment: segment
            };
        }

        function ROLLBACK(mark) {
            tok     = mark.tok;
            i       = mark.i;
            eof     = mark.eof;
            line    = mark.line;
            col     = mark.col;
            segment = mark.segment;
        }
    }
});
