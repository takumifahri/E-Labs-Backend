export const logger = {
    info: (msg: string, ...params: any[]) => console.info(`[INFO] ${msg}`, ...params),
    debug: (msg: string, ...params: any[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[DEBUG] ${msg}`, ...params);
        }
    },
    warn: (msg: string, ...params: any[]) => console.warn(`[WARN] ${msg}`, ...params),
    error: (msg: string, ...params: any[]) => console.error(`[ERROR] ${msg}`, ...params),
    trace: (msg: string, ...params: any[]) => {
        // Selalu tampilkan trace, bisa tambahkan stack trace jika perlu
        console.trace(`[TRACE] ${msg}`, ...params);
    },
    time: (label: string) => console.time(`[PERF] ${label}`),
    timeEnd: (label: string) => console.timeEnd(`[PERF] ${label}`),
};