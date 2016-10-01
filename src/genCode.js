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
            hash = hash52(html),
            nl = "\n" + indent(prior),
            directives = this.nodes.length > 1 ? genChildDirectives(opts, this.nodes, nl) : this.nodes[0].genDirectives(opts, nl),
            code = "new " + opts.symbol + "(" + hash + "," + nl + codeStr(html) + ")";

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
            mixins = concatResults(opts, this.mixins, 'genDirective', nl);

        return childDirectives + (childDirectives && (properties || mixins) ? nl : "")
            + properties + (properties && mixins ? nl : "")
            + mixins;
    };
    AST.HtmlComment.prototype.genDirectives =
    AST.HtmlText.prototype.genDirectives    = function (opts, nl) { return null; };
    AST.HtmlInsert.prototype.genDirectives  = function (opts, nl) {
        return ".insert(function () { return " + this.code.genCode(opts) + "; })";
    }

    // genDirective
    AST.Property.prototype.genDirective = function (opts) {
        var code = this.code.genCode(opts);
        return ".property(function (__) { __." + this.name + " = " + code + "; })";
    };
    AST.Mixin.prototype.genDirective = function (opts) {
        return ".mixin(function () { return " + this.code.genCode(opts) + "; })";
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
