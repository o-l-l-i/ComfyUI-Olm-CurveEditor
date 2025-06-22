// === Clamp helper ===
export function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}


// === Compute monotonic tangents ===
export function computeMonotonicTangents(points) {
    const tangents = new Array(points.length).fill(0);

    for (let i = 1; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i - 1].x;
        const dy = points[i + 1].y - points[i - 1].y;
        tangents[i] = dx === 0 ? 0 : dy / dx;
    }

    tangents[0] = (points[1].y - points[0].y) / (points[1].x - points[0].x);
    tangents[points.length - 1] = (points[points.length - 1].y - points[points.length - 2].y) /
                                  (points[points.length - 1].x - points[points.length - 2].x);

    return tangents;
}


// === Hermite interpolation with tangents ===
export function hermiteInterp(y0, y1, m0, m1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * m0 +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * m1
    );
}


// === Sample y for given x from monotonic spline ===
export function sampleMonotonicSplineY(x, points, tangents) {
    if (points.length < 2) return 0;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        if (x >= p0.x && x <= p1.x) {
            const t = (x - p0.x) / (p1.x - p0.x);
            const m0 = tangents[i] * (p1.x - p0.x);
            const m1 = tangents[i + 1] * (p1.x - p0.x);
            return clamp01(hermiteInterp(p0.y, p1.y, m0, m1, t));
        }
    }

    return x <= points[0].x ? points[0].y : points[points.length - 1].y;
}


// === Main API: compute monotonic curve samples ===
export function getSmoothMonotonicCurveHermite(points, resolution = 100) {
    const result = [];
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const tangents = computeMonotonicTangents(sorted);

    for (let i = 0; i < resolution; i++) {
        const x = i / (resolution - 1);
        const y = sampleMonotonicSplineY(x, sorted, tangents);
        result.push({ x, y });
    }

    return result;
}