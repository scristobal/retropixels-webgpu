function timeTrack() {
    let lastCall = performance.now();
    const frameTimes = new Float32Array(1024);
    let frameTimesInd = 0;

    return function report() {
        const now = performance.now();
        const delta = now - lastCall;
        frameTimes[++frameTimesInd] = delta;

        if (frameTimesInd === frameTimes.length) {
            const average = frameTimes.reduce((acc, cur) => acc + cur, 0) / frameTimes.length;
            console.log(`${average.toFixed(3)}ms ~${(1000 / average).toFixed(3)}fps`);
            frameTimesInd = 0;
        }

        lastCall = now;

        return delta;
    };
}

export { timeTrack };
