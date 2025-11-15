import { PriceRange } from "../../server/services/price-data/price-history-model";

export class PriceRangeImpl implements PriceRange {
  private _min: number;
  private _max: number;
  private _range: number;
  private _minRange: number = 0.0001;

  constructor(min: number, max: number) {
    this._min = min;
    this._max = max;
    this._range = max - min;
  }

  get min(): number {
    return this._min;
  }
  get max(): number {
    return this._max;
  }
  get range(): number {
    return this._range;
  }

  public adjust(deltaY: number, zoomCenter: number): void {
    // zoomCenter is between 0 and 1, representing the position of the mouse
    const rangeAdjustment = this._range * 0.005 * deltaY;
    const newRange = Math.max(this._range - rangeAdjustment, this._minRange);
    const rangeDifference = this._range - newRange;

    // Apply the zoom centered around the mouse position
    this._min += rangeDifference * (1 + zoomCenter);
    this._max -= rangeDifference * (1 - zoomCenter);
    this._range = newRange;
  }

  public shift(amount: number): void {
    this._min += amount;
    this._max += amount;
  }

  public setMin(min: number): void {
    this._min = min;
    this._range = this._max - this._min;
  }

  public setMax(max: number): void {
    this._max = max;
    this._range = this._max - this._min;
  }

  public setMinRange(minRange: number): void {
    this._minRange = minRange;
  }
}
