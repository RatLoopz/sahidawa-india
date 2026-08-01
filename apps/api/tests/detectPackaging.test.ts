/**
 * @jest-environment jsdom
 */

import { detectPackaging } from "../../web/lib/vision/detectPackaging";
import { loadOpenCv } from "../../web/lib/vision/loadOpenCv";

jest.mock("../../web/lib/vision/loadOpenCv", () => ({
    loadOpenCv: jest.fn(),
}));

const mockedLoadOpenCv = loadOpenCv as jest.Mock;

function createMat(rows = 100, cols = 100) {
    return {
        rows,
        cols,
        delete: jest.fn(),
        intAt: jest.fn(),
    };
}

describe("detectPackaging", () => {
    let cv: any;

    beforeEach(() => {
        cv = {
            COLOR_RGBA2GRAY: 0,
            RETR_EXTERNAL: 0,
            CHAIN_APPROX_SIMPLE: 0,

            Mat: jest.fn(() => createMat()),

            MatVector: jest.fn(() => ({
                size: jest.fn(() => 0),
                get: jest.fn(),
                delete: jest.fn(),
            })),

            Size: jest.fn(),

            imread: jest.fn(() => createMat()),

            cvtColor: jest.fn(),
            GaussianBlur: jest.fn(),
            Canny: jest.fn(),
            findContours: jest.fn(),

            contourArea: jest.fn(),
            arcLength: jest.fn(),

            approxPolyDP: jest.fn(),

            isContourConvex: jest.fn(),
        };

        mockedLoadOpenCv.mockResolvedValue(cv);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("returns false when no contours are found", async () => {
        const canvas = document.createElement("canvas");

        const result = await detectPackaging(canvas);

        expect(result.looksLikePackaging).toBe(false);
    });

    it("ignores contours smaller than minimum area", async () => {
        const contour = {
            delete: jest.fn(),
        };

        cv.MatVector.mockReturnValue({
            size: () => 1,
            get: () => contour,
            delete: jest.fn(),
        });

        cv.contourArea.mockReturnValue(10);

        const canvas = document.createElement("canvas");

        const result = await detectPackaging(canvas, {
            minAreaRatio: 0.5,
        });

        expect(result.looksLikePackaging).toBe(false);
    });

    it("detects valid rectangular packaging", async () => {
        const contour = {
            delete: jest.fn(),
        };

        cv.MatVector.mockReturnValue({
            size: () => 1,
            get: () => contour,
            delete: jest.fn(),
        });

        cv.contourArea.mockReturnValue(5000);
        cv.arcLength.mockReturnValue(400);

        cv.approxPolyDP.mockImplementation((_: any, approx: any) => {
            approx.rows = 4;

            approx.intAt = jest
                .fn()
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(100);
        });

        cv.isContourConvex.mockReturnValue(true);

        const canvas = document.createElement("canvas");

        const result = await detectPackaging(canvas);

        expect(result.looksLikePackaging).toBe(true);
    });

    it("rejects non-convex quadrilaterals", async () => {
        const contour = {
            delete: jest.fn(),
        };

        cv.MatVector.mockReturnValue({
            size: () => 1,
            get: () => contour,
            delete: jest.fn(),
        });

        cv.contourArea.mockReturnValue(5000);
        cv.arcLength.mockReturnValue(400);

        cv.approxPolyDP.mockImplementation((_: any, approx: any) => {
            approx.rows = 4;
        });

        cv.isContourConvex.mockReturnValue(false);

        const canvas = document.createElement("canvas");

        const result = await detectPackaging(canvas);

        expect(result.looksLikePackaging).toBe(false);
    });

    it("releases allocated OpenCV resources", async () => {
        const src = createMat();

        cv.imread.mockReturnValue(src);

        const canvas = document.createElement("canvas");

        await detectPackaging(canvas);

        expect(src.delete).toHaveBeenCalled();
    });
});
