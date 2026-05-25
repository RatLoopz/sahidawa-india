function clampChannel(value) {
    return Math.min(255, Math.max(0, value));
}

function rgbToHsl(red, green, blue) {
    const normalizedRed = red / 255;
    const normalizedGreen = green / 255;
    const normalizedBlue = blue / 255;
    const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const lightness = (max + min) / 2;

    if (max === min) {
        return [0, 0, lightness];
    }

    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    let hue = 0;
    switch (max) {
        case normalizedRed:
            hue =
                (normalizedGreen - normalizedBlue) / delta +
                (normalizedGreen < normalizedBlue ? 6 : 0);
            break;
        case normalizedGreen:
            hue = (normalizedBlue - normalizedRed) / delta + 2;
            break;
        default:
            hue = (normalizedRed - normalizedGreen) / delta + 4;
            break;
    }

    return [hue / 6, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
    if (saturation === 0) {
        const channel = lightness * 255;
        return [channel, channel, channel];
    }

    const q =
        lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    const hueToChannel = (offset) => {
        let channelHue = offset;
        if (channelHue < 0) channelHue += 1;
        if (channelHue > 1) channelHue -= 1;
        if (channelHue < 1 / 6) return p + (q - p) * 6 * channelHue;
        if (channelHue < 1 / 2) return q;
        if (channelHue < 2 / 3) return p + (q - p) * (2 / 3 - channelHue) * 6;
        return p;
    };

    return [
        hueToChannel(hue + 1 / 3) * 255,
        hueToChannel(hue) * 255,
        hueToChannel(hue - 1 / 3) * 255,
    ];
}

function applySelectiveSaturation(pixels) {
    const enhanced = new Uint8ClampedArray(pixels);

    for (let index = 0; index < enhanced.length; index += 4) {
        const [hue, saturation, lightness] = rgbToHsl(
            enhanced[index],
            enhanced[index + 1],
            enhanced[index + 2]
        );

        if (lightness <= 0.15 || lightness >= 0.85 || saturation <= 0.05) {
            continue;
        }

        const luminanceMask = 1 - Math.abs(lightness - 0.5) * 2;
        const nextSaturation = Math.min(
            1,
            Math.max(0, saturation + saturation * (1 - saturation) * 0.3 * luminanceMask)
        );
        const [red, green, blue] = hslToRgb(hue, nextSaturation, lightness);

        enhanced[index] = clampChannel(red);
        enhanced[index + 1] = clampChannel(green);
        enhanced[index + 2] = clampChannel(blue);
    }

    return enhanced;
}

function applyUnsharpMask(pixels, width, height) {
    if (width < 3 || height < 3) {
        return pixels;
    }

    const sharpened = new Uint8ClampedArray(pixels);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = (y * width + x) * 4;

            for (let channel = 0; channel < 3; channel++) {
                const value =
                    3.0 * pixels[index + channel] -
                    0.5 * pixels[((y - 1) * width + x) * 4 + channel] -
                    0.5 * pixels[((y + 1) * width + x) * 4 + channel] -
                    0.5 * pixels[(y * width + (x - 1)) * 4 + channel] -
                    0.5 * pixels[(y * width + (x + 1)) * 4 + channel];

                sharpened[index + channel] = clampChannel(value);
            }
        }
    }

    return sharpened;
}

self.onmessage = (event) => {
    const { id, pixels, width, height } = event.data;

    try {
        const enhancedPixels = applyUnsharpMask(applySelectiveSaturation(pixels), width, height);
        self.postMessage({ id, pixels: enhancedPixels }, [enhancedPixels.buffer]);
    } catch (error) {
        self.postMessage({
            id,
            error: error instanceof Error ? error.message : "Image enhancement worker failed.",
        });
    }
};
