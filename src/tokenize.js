define('tokenize', [], function () {
    /// tokens:
    /// < (followed by \w)
    /// </ (followed by \w))
    /// >
    /// />
    /// <!--
    /// -->
    /// @
    /// = (followed by \s*[^"'])
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
    /// misc (any string not containing one of the above)
    // pre-compiled regular expressions

    var rx = {
        tokens: /<\/?(?=\w)|\/?>|<!--|-->|@|=|\)|\(|\[|\]|\{|\}|"|'|\/\/|\n|(?:[^<>@=\/@=()[\]{}"'\n-]|(?!-->)-|\/(?![>/])|(?!<\/?\w|<!--)<\/?)+/g,
    };

    return function tokenize(str) {
        var TOKS = str.match(rx.tokens);

        return TOKS;
    }
});
