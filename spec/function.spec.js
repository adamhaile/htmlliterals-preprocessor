describe("HTML function macro", function () {
    it("creates a function with the given body", function () {
        eval(htmlliterals.preprocess('                          \
            var clicked = false,                                \
                a = <a onclick => (clicked = true)>link</a>;    \
                                                                \
            expect(a.onclick).toEqual(jasmine.any(Function));   \
            expect(clicked).toBe(false);                        \
            a.onclick();                                        \
            expect(clicked).toBe(true);                         \
        '));
    });
});
