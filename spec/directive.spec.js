describe("HTML directive", function () {
    var argsSpy = jasmine.createSpy(),
        nodeSpy = jasmine.createSpy().and.returnValue(argsSpy);

    Html.addDirective("test", nodeSpy);

    it("is called with the node then the args", function () {
        eval(htmlliterals.preprocess('                      \
            argsSpy.calls.reset(), nodeSpy.calls.reset();   \
                                                            \
            var a = <a @test("foo", 2) />;                  \
                                                            \
            expect(nodeSpy).toHaveBeenCalledWith(a);        \
            expect(argsSpy).toHaveBeenCalledWith("foo", 2); \
        '));
    });

    it("can be called in an assignment style", function () {
        eval(htmlliterals.preprocess('                      \
            argsSpy.calls.reset(), nodeSpy.calls.reset();   \
                                                            \
            var a = <a @test = "foo" />;                    \
                                                            \
            expect(nodeSpy).toHaveBeenCalledWith(a);        \
            expect(argsSpy).toHaveBeenCalledWith("foo");    \
        '));
    });

    it("can be called in an assignment style with optional string params", function () {
        eval(htmlliterals.preprocess('                      \
            argsSpy.calls.reset(), nodeSpy.calls.reset();   \
                                                            \
            var a = <a @test:foo = 2 />;                    \
                                                            \
            expect(nodeSpy).toHaveBeenCalledWith(a);        \
            expect(argsSpy).toHaveBeenCalledWith("foo", 2); \
        '));
    });
});
