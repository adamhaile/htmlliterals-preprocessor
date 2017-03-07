define('genCode', ['AST', 'sourcemap'], function (AST, sourcemap) {

    // pre-compiled regular expressions
    var rx = {
        backslashes        : /\\/g,
        newlines           : /\r?\n/g,
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
    AST.HtmlLiteral.prototype.genCode = function (opts, prior) {
        var html = concatResults(opts, this.nodes, 'genHtml'),
            id = hash52(html),
            nl = "\r\n" + indent(prior),
            init = genInit(opts, this.nodes, nl),
            code = opts.symbol + "(" + id + "," + nl + codeStr(html) + ")";

        if (init) code = "(" + init + ")(" + code + ")";

        return code;
    };

    // genHtml
    AST.HtmlElement.prototype.genHtml = function(opts) {
        return this.beginTag + concatResults(opts, this.content, 'genHtml') + (this.endTag || "");
    };
    AST.HtmlComment.prototype.genHtml =
    AST.HtmlText.prototype.genHtml    = function (opts) { return this.text; };
    AST.HtmlInsert.prototype.genHtml  = function (opts) { return '<!-- insert -->'; };

    // genRefs
    AST.HtmlElement.prototype.genCommands = function (opts, refs, cmds, refnum, parentnum, child) {
        var cmdlen = cmds.length;
        for (var i = 0; i < this.content.length; i++) {
            this.content[i].genCommands(opts, refs, cmds, Math.max(refnum + 1, refs.length), refnum, i);
        }
        for (i = 0; i < this.properties.length; i++) {
            this.properties[i].genCommand(opts, cmds, refnum);
        }
        for (i = 0; i < this.mixins.length; i++) {
            this.mixins[i].genCommand(opts, cmds, refnum);
        }
        if (cmds.length !== cmdlen && refnum !== -1) refs[refnum] = declareRef(refnum, parentnum, child);
    };
    AST.HtmlComment.prototype.genCommands =
    AST.HtmlText.prototype.genCommands    = function (opts, refs, cmds, refnum, parentnum, child) { };
    AST.HtmlInsert.prototype.genCommands  = function (opts, refs, cmds, refnum, parentnum, child) {
        refs[refnum] = declareRef(refnum, parentnum, child);
        cmds.push(opts.symbol + ".exec(function (state) { return Html.insert(" + ref(refnum) + ", " + this.code.genCode(opts) + ", state); });");
    };

    // genDirective
    AST.Property.prototype.genCommand = function (opts, cmds, refnum) {
        var code = this.code.genCode(opts);
        cmds.push(opts.symbol + ".exec(function () { " + ref(refnum) + "." + this.name + " = " + code + "; });");
    };
    AST.Mixin.prototype.genCommand = function (opts, cmds, refnum) {
        var code = this.code.genCode(opts);
        cmds.push(opts.symbol + ".exec(function (state) { return " + this.code.genCode(opts) + "(" + ref(refnum) + ", state); });");
    };

    function declareRef(refnum, parentnum, child) {
        return "var " + ref(refnum) + " = " + ref(parentnum) + ".childNodes[" + child + "];";
    }

    function ref(refnum) {
        return "__" + (refnum === -1 ? '' : refnum);
    }

    function genInit(opts, nodes, nl) {
        var refs = [],
            cmds = [],
            //identifiers = [],
            cnl = nl + "    ",
            i;

        if (nodes.length === 1) {
            nodes[0].genCommands(opts, refs, cmds, -1, -1, 0);
        } else {
            for (i = 0; i < nodes.length; i++) {
                nodes[i].genCommands(opts, refs, cmds, refs.length, -1, i);
            }
        }

        if (cmds.length === 0) return null;

        return "function (__) {" + cnl + refs.join(cnl) + cnl + cmds.join(cnl) + cnl + "return __;" + nl + "}";
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

    var MAX32 = Math.pow(2 ,32);

    // K&R hash, returning 52-bit integer, the max a double can represent
    // this gives us an 0.0001% chance of collision with 67k templates (a lot of templates)
    function hash52(str) {
        var low = 0, high = 0, i, len, c, v;
        for (i = 0, len = str.length; i < len; i++) {
            c = str.charCodeAt(i);
            v = (low * 31) + c;
            low = v|0;
            c = (v - low) / MAX32;
            high = (high * 31 + c)|0;
        }
        return ((high & 0xFFFFF) * MAX32) + low;
    }
});
