module.exports = async () => {
    // Close any open handles by forcing garbage collection if available
    if (global.gc) {
        global.gc();
    }
};
