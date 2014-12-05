import tokenize from 'htmlliterals-preprocessor/tokenize';
import parse from 'htmlliterals-preprocessor/parse';
import 'htmlliterals-preprocessor/genCode';
import shimmed from 'htmlliterals-preprocessor/shims';

export default function preprocess(str) {
    var toks = tokenize(str),
        ast = parse(toks);

    if (shimmed) ast.shim();

    var out = ast.genCode();

    return out;
}

function add(str) {
    var src = K.DOM.src(str),
        script = document.createElement('script');

    script.type = 'text/javascript';
    script.src  = 'data:text/javascript;charset=utf-8,' + escape(src);

    document.body.appendChild(script);
}
