const tsJest = require("ts-jest");

const path = require("path");

const transformerConfig = {
    tsconfig: path.join(__dirname, "tsconfig.test.json"),
    useESM: false,
};

module.exports = {
    process(sourceText, sourcePath, options) {
        if (sourceText.includes("import.meta.url")) {
            sourceText = sourceText.replace(/import\.meta\.url/g, '"http://localhost"');
        }
        const transformer = tsJest.default ? tsJest.default.createTransformer(transformerConfig) : tsJest.createTransformer(transformerConfig);
        return transformer.process(sourceText, sourcePath, options);
    }
};
