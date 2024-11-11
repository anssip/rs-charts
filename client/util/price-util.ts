
export function formatPrice(price: number): string {
    if (price > 1000) {
        return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return price.toFixed(2);
}

export function getPriceStep(priceRange: number): number {
    // We want roughly 6-10 price levels on the axis
    // If price range is 15000-14000 = 1000, we want steps of 100
    // Calculate magnitude (power of 10) of the price range
    const magnitude = Math.floor(Math.log10(priceRange));
    const normalizedRange = priceRange / Math.pow(10, magnitude);

    // Choose appropriate step size based on normalized range
    let step;
    if (normalizedRange >= 5) {
        step = 2;
    } else {
        step = 1;
    }
    // Scale step back to original magnitude
    return step * Math.pow(10, magnitude - 1);
}