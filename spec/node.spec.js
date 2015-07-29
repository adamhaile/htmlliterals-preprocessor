describe("HTML node literal", function () {
    it("converts inline HTML to DOM objects", function () {
        eval(htmlliterals.preprocess('                          \
            var div = <div></div>,                              \
                ul  = <ul>                                      \
                        <li>one</li>                            \
                        <li>two</li>                            \
                      </ul>,                                    \
                a   = <a href="#">link</a>,                     \
                comment = <!-- comment -->;                     \
                                                                \
            expect(div instanceof HTMLDivElement).toBe(true);   \
            expect(ul instanceof HTMLUListElement).toBe(true);  \
            expect(a instanceof HTMLAnchorElement).toBe(true);  \
            expect(comment instanceof Comment).toBe(true);      \
        '));
    });

    it("preserves static attributes", function () {
        eval(htmlliterals.preprocess('                          \
            var a = <a href="#" target="top"></a>;              \
                                                                \
            expect(a.getAttribute("href")).toBe("#");           \
        '));
    });
});
