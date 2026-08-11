import { jobScheduler } from "../src/services/jobScheduler.service";
import * as smsWorkerModule from "../src/workers/smsWorker";

jest.mock("../src/cron/alert-broadcaster", () => ({
    startAlertBroadcaster: () => ({ stop: () => {} }),
}));
jest.mock("../src/cron/tempCleanup", () => ({
    startTempCleanupJob: () => ({ stop: () => {} }),
}));
jest.mock("../src/cron/expiry-check", () => ({
    initExpiryCron: () => ({ stop: () => {} }),
}));
jest.mock("../src/cron/districtAlertSync", () => ({
    initDistrictAlertSyncCron: () => ({ stop: () => {} }),
}));
jest.mock("../src/cron/pgCronMonitor", () => ({
    startPgCronMonitor: () => ({ stop: () => {} }),
}));

const startSmsWorkerMock = jest.spyOn(smsWorkerModule, "startSmsWorker").mockImplementation(() => ({
    stop: () => {},
}));

afterEach(() => {
    startSmsWorkerMock.mockClear();
    jobScheduler.shutdown();
});

describe("JobScheduler", () => {
    it("starts the SMS worker when background jobs are started", () => {
        jobScheduler.start();

        expect(startSmsWorkerMock).toHaveBeenCalled();
    });

    it("does not start the SMS worker twice when start is called again", () => {
        jobScheduler.start();
        jobScheduler.start();

        expect(startSmsWorkerMock).toHaveBeenCalledTimes(1);
    });
});
