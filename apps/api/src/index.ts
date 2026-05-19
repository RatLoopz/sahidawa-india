import app from "./app";
import logger from "./utils/logger";

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => {
        logger.info(`SahiDawa API is running at http://localhost:${port}`);
    });
}
