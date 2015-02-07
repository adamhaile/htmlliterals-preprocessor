define('AST', [], function () {
    return {
        CodeTopLevel: function (segments) {
            this.segments = segments; // [ CodeText | HtmlLiteral ]
        },
        CodeText: function (text) {
            this.text = text; // string
        },
        EmbeddedCode: function (segments) {
            this.segments = segments; // [ CodeText | HtmlLiteral ]
        },
        HtmlLiteral: function(col, nodes) {
            this.col = col; // integer
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
        HtmlInsert: function (col, code) {
            this.col = col; // integer
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
