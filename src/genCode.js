define('genCode', ['AST'], function (AST) {

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
    AST.EmbeddedCode.prototype.genCode   = function () { return concatResults(this.segments, 'genCode'); };
    AST.CodeText.prototype.genCode       = function () { return this.text; };
    var htmlLiteralId = 0; //Math.floor(Math.random() * Math.pow(2, 31));
    AST.HtmlLiteral.prototype.genCode = function (prior) {
        var html = concatResults(this.nodes, 'genHtml'),
            nl = "\n" + indent(prior),
            directives = this.nodes.length > 1 ? genChildDirectives(this.nodes, nl) : this.nodes[0].genDirectives(nl),
            code = "new Html(" + htmlLiteralId++ + "," + nl + codeStr(html) + ")";

        if (directives) code += nl + directives + nl;

        code = "(" + code + ".node)";

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

        return properties + (properties && (directives || childDirectives) ? nl : "")
            + directives + (directives && childDirectives ? nl : "")
            + childDirectives;
    };
    AST.HtmlComment.prototype.genDirectives =
    AST.HtmlText.prototype.genDirectives    = function (nl) { return null; };
    AST.HtmlInsert.prototype.genDirectives  = function (nl) {
        return new AST.AttrStyleDirective('insert', [], this.code).genDirective();
    }

    // genDirective
    AST.Property.prototype.genDirective = function () {
        var code = this.code.genCode();
        if (this.callback) code = genCallback(this.name, code);
        return ".property(function (__) { __." + this.name + " = " + code + "; })";
    };
    AST.Directive.prototype.genDirective = function () {
        return "." + this.name + "(function (__) { __" + this.code.genCode() + "; })";
    };
    AST.AttrStyleDirective.prototype.genDirective = function () {
        var code = "." + this.name + "(function (__) { __(";

        for (var i = 0; i < this.params.length; i++)
            code += codeStr(this.params[i]) + ", ";

        code += this.callback ? genCallback(this.name, this.code.genCode()) : this.code.genCode();

        code += "); })";

        return code;
    };

    function genChildDirectives(childNodes, nl) {
        var indices = [],
            directives = [],
            identifiers = [],
            cnl = nl + "    ",
            ccnl = cnl + "     ",
            directive,
            i,
            result = "";

        for (i = 0; i < childNodes.length; i++) {
            directive = childNodes[i].genDirectives(ccnl);
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

    function concatResults(children, method, sep) {
        var result = "", i;

        for (i = 0; i < children.length; i++) {
            if (i && sep) result += sep;
            result += children[i][method](result);
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
