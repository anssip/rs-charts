export class PriceRangeImpl {
    private _min: number;
    private _max: number;
    private _range: number;

    constructor(min: number, max: number) {
        this._min = min;
        this._max = max;
        this._range = max - min;
    }

    get min(): number { return this._min; }
    get max(): number { return this._max; }
    get range(): number { return this._range; }

    public adjust(deltaY: number, zoomCenter: number): void {
        // zoomCenter is between 0 and 1, representing the position of the mouse
        const rangeAdjustment = this._range * 0.005 * deltaY;
        const newRange = Math.max(this._range - rangeAdjustment, 0.0001);
        const rangeDifference = this._range - newRange;

        // Apply the zoom centered around the mouse position
        this._min += rangeDifference * zoomCenter;
        this._max -= rangeDifference * (1 - zoomCenter);
        this._range = newRange;
    }
} 