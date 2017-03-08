describe("HTML fragment literal", function () {
    it("converts inline HTML fragments to DOM fragments", function () {
        eval(htmlliterals.preprocess('                          \
            var frag = <p>para 1</p>                            \
                       <p>para 2</p>                            \
                       <p>para 3</p>;                           \
                                                                \
            expect(frag instanceof DocumentFragment).toBe(true);\
            expect(frag.childNodes.length).toBe(3);             \
        '));
    });

    it("fragments can begin with a node, comment or insert", function () {
        eval(htmlliterals.preprocess('                             \
            var node    = <p>para 1</p>                            \
                          <!-- comment -->                         \
                          @"text",                                 \
                comment = <!-- comment -->                         \
                          <p>para 1</p>                            \
                          @"text",                                 \
                insert =  @"text"                                  \
                          <p>para 1</p>                            \
                          <!-- comment -->;                        \
                                                                   \
            expect(node instanceof DocumentFragment).toBe(true);   \
            expect(comment instanceof DocumentFragment).toBe(true);\
            expect(insert instanceof DocumentFragment).toBe(true); \
        '));
    });
});
