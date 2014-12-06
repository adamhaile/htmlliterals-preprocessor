define('genCode', ['AST'], function (AST) {

    // pre-compiled regular expressions
    var rx = {
        eventProperty      : /^on/,
        backslashes        : /\\/g,
        newlines           : /\n/g,
        singleQuotes       : /'/g
    };

    // genCode
    AST.CodeTopLevel.prototype.genCode   =
    AST.EmbeddedCode.prototype.genCode   = function () { return concatResults(this.segments, 'genCode'); };
    AST.CodeText.prototype.genCode       = function () { return this.text; };
    var htmlLiteralId = Math.floor(Math.random() * Math.pow(2, 31));
    AST.HtmlLiteral.prototype.genCode = function () {
        var html = concatResults(this.nodes, 'genHtml'),
            nl = "\n" + indent(this.col),
            directives = this.nodes.length > 1 ? genChildDirectives(this.nodes, nl) : this.nodes[0].genDirectives(nl),
            code = "(htmlliterals.cachedParse(" + htmlLiteralId++ + "," + nl + codeStr(html) + "))";

        if (directives) code = "(new htmlliterals.Shell" + code + nl + directives + nl + ".node)";

        return code;
    };

    // genHtml
    AST.HtmlElement.prototype.genHtml = function() {
        return this.beginTag + concatResults(this.content, 'genHtml') + (this.endTag || "");
    };
    AST.HtmlComment.prototype.genHtml =
    AST.HtmlText.prototype.genHtml    = function () { return this.text; };
    AST.HtmlInsert.prototype.genHtml  = function () { return '<!-- insert -->'; };

    // genDirectives
    AST.HtmlElement.prototype.genDirectives = function (nl) {
        var childDirectives = genChildDirectives(this.content, nl),
            properties = concatResults(this.properties, 'genDirective', nl),
            directives = concatResults(this.directives, 'genDirective', nl);

        return childDirectives + (childDirectives && (properties || directives) ? nl : "")
            + properties + (properties && directives ? nl : "")
            + directives;
    };
    AST.HtmlComment.prototype.genDirectives =
    AST.HtmlText.prototype.genDirectives    = function (nl) { return null; };
    AST.HtmlInsert.prototype.genDirectives  = function (nl) {
        return new AST.AttrStyleDirective('insert', [], this.code).genDirective();
    }

    // genDirective
    AST.Property.prototype.genDirective = function () {
        var code = this.code.genCode();
        if (rx.eventProperty.test(this.name)) code = "function (__) { " + code + "; }";
        return ".property(function (__) { return __." + this.name + " = " + code + "; })";
    };
    AST.Directive.prototype.genDirective = function () {
        return ".directive(" + codeStr(this.name) + ", function (__) { __" + this.code.genCode() + "; })";
    };
    AST.AttrStyleDirective.prototype.genDirective = function () {
        var directive = directives[this.name];
        if (directive === undefined)
            throw new Error("Unrecognized directive @" + this.name);

        var code = ".directive(" + codeStr(this.name) + ", function (__) { __(";

        for (var i = 0; i < this.params.length; i++)
            code += codeStr(this.params[i]) + ", ";

        code += directive.wrapCallback ? 'function (__) { ' + this.code.genCode() + '; }' :
                this.code.genCode();

        code += "); })";

        return code;
    };

    function genChildDirectives(childNodes, nl) {
        var indices = [],
            directives = [],
            cnl = nl + "    ",
            ccnl = cnl + "    ",
            directive,
            i,
            result = "";

        for (i = 0; i < childNodes.length; i++) {
            directive = childNodes[i].genDirectives(ccnl);
            if (directive) {
                indices.push(i);
                directives.push(directive);
            }
        }

        if (indices.length) {
            result += ".childNodes([" + indices.join(", ") + "], function (__) {" + cnl;
            for (i = 0; i < directives.length; i++) {
                if (i) result += cnl;
                result += "__[" + i + "]" + directives[i] + ";"
            }
            result += nl + "})";
        }

        return result;
    }

    function concatResults(children, method, sep) {
        var result = "", i;

        for (i = 0; i < children.length; i++) {
            if (i && sep) result += sep;
            result += children[i][method]();
        }

        return result;
    }

    function codeStr(str) {
        return "'" + str.replace(rx.backslashes, "\\\\")
                        .replace(rx.singleQuotes, "\\'")
                        .replace(rx.newlines, "\\\n")
                   + "'";
    }

    function indent(col) {
        return new Array(col + 1).join(" ");
    }
});
