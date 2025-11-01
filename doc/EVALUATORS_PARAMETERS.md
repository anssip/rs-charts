# Market API Server - Configurable Indicator Parameters

## Overview
Server-side implementation plan for accepting and processing custom indicator parameters in the Market API. This enables clients to request indicators calculated with specific parameters (e.g., SMA with periods 20/100 instead of default 50/200).

**DO THIS FIRST** - Server changes must be deployed before client changes.

---

## Current State Analysis

### Current Request Format
```
GET /history?symbol=BTC-USD&interval=ONE_HOUR&evaluators=moving-averages,rsi
```

**Problems:**
1. Evaluators are simple comma-separated strings
2. No way to pass parameters like period, type, etc.
3. Server uses hardcoded default parameters
4. Returns generic names (`fast_ma`, `slow_ma`) instead of period-specific names

### Current Response Format
```json
{
  "candles": [
    {
      "timestamp": 1704067200000,
      "open": 42000,
      "close": 42500,
      "evaluations": [
        {
          "id": "moving-averages",
          "values": [
            {"name": "fast_ma", "timestamp": 1704067200000, "value": 93439.00},
            {"name": "slow_ma", "timestamp": 1704067200000, "value": 95198.98}
          ]
        }
      ]
    }
  ]
}
```

**Note:** The actual API returns indicators nested within each candle, with each indicator value having a timestamp matching the candle timestamp. This structure is correct and should be maintained.

**Problems:**
1. No indication of which periods were used
2. Generic names don't match client expectations
3. No parameter echo in response

---

## Required Changes

### New Request Format

**Option A: JSON in Query Parameter (RECOMMENDED)**
```
GET /history?symbol=BTC-USD&interval=ONE_HOUR&evaluators=[{"id":"moving-averages","params":{"fastPeriod":20,"slowPeriod":100}},{"id":"rsi","params":{"period":14}}]
```

URL-encoded:
```
evaluators=%5B%7B%22id%22%3A%22moving-averages%22%2C%22params%22%3A%7B%22fastPeriod%22%3A20%2C%22slowPeriod%22%3A100%7D%7D%5D
```

**Why JSON?**
- Supports complex nested parameters
- Easy to parse in any language
- Clear structure
- Extensible for future parameters

### New Response Format
```json
{
  "candles": [
    {
      "timestamp": 1704067200000,
      "open": 42000,
      "high": 42800,
      "low": 41900,
      "close": 42500,
      "volume": 1234.56,
      "evaluations": [
        {
          "id": "moving-averages",
          "params": {
            "fastPeriod": 20,
            "slowPeriod": 100
          },
          "values": [
            {"name": "ma20", "timestamp": 1704067200000, "value": 93245.50},
            {"name": "ma100", "timestamp": 1704067200000, "value": 94876.23}
          ]
        },
        {
          "id": "rsi",
          "params": {
            "period": 14
          },
          "values": [
            {"name": "rsi", "timestamp": 1704067200000, "value": 65.4}
          ]
        }
      ]
    },
    {
      "timestamp": 1704070800000,
      "open": 42500,
      "high": 43100,
      "low": 42400,
      "close": 42900,
      "volume": 1567.89,
      "evaluations": [
        {
          "id": "moving-averages",
          "params": {
            "fastPeriod": 20,
            "slowPeriod": 100
          },
          "values": [
            {"name": "ma20", "timestamp": 1704070800000, "value": 93350.75},
            {"name": "ma100", "timestamp": 1704070800000, "value": 94920.12}
          ]
        },
        {
          "id": "rsi",
          "params": {
            "period": 14
          },
          "values": [
            {"name": "rsi", "timestamp": 1704070800000, "value": 68.2}
          ]
        }
      ]
    }
  ]
}
```

**Key Changes:**
1. Added `params` field to each evaluation (echoes request params)
2. Value names are now period-specific: `ma20`, `ma100`, `rsi`
3. Clear indication of calculation parameters used
4. **CRITICAL:** Each indicator value includes `timestamp` field matching its parent candle
5. Evaluations are nested within each candle object (one set of indicators per candle)
6. Each candle has its own calculated indicator values at that specific timestamp

---

## Implementation Plan

### IMPORTANT: Timestamp Requirements

**CRITICAL:** All indicator values MUST include timestamps that match their parent candle timestamp.

The existing API architecture correctly returns:
- One set of indicator values **per candle**
- Each indicator value has a `timestamp` field
- The timestamp matches the parent candle's timestamp
- Evaluations are nested within each candle object

**Why timestamps matter:**
1. **Data integrity** - Ensures indicators align with correct candles
2. **Chart plotting** - Enables accurate visualization even with sparse data
3. **Debugging** - Easy to verify alignment between candles and indicators
4. **Flexibility** - Supports future features requiring timestamp-level granularity

**DO NOT:**
- Return a single set of indicators for all candles
- Omit timestamps from indicator values
- Use different timestamps for indicators vs candles

**Example structure (CORRECT):**
```typescript
{
  candles: [
    {
      timestamp: 1704067200000,
      close: 42500,
      evaluations: [{
        id: "moving-averages",
        values: [
          { name: "ma50", timestamp: 1704067200000, value: 93439.00 }  // ← Same timestamp
        ]
      }]
    }
  ]
}
```

---

### Phase 1: OpenAPI Specification Update

**File:** `openapi.yaml` (or equivalent API spec)

**Update `/history` endpoint:**

```yaml
paths:
  /history:
    get:
      parameters:
        - name: symbol
          in: query
          required: true
          schema:
            type: string
          example: BTC-USD

        - name: interval
          in: query
          required: true
          schema:
            type: string
            enum: [ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, SIX_HOUR, ONE_DAY]

        - name: startTime
          in: query
          required: true
          schema:
            type: integer
            format: int64
          description: Unix timestamp in milliseconds

        - name: endTime
          in: query
          required: true
          schema:
            type: integer
            format: int64
          description: Unix timestamp in milliseconds

        - name: evaluators
          in: query
          required: false
          schema:
            type: string
          description: JSON-encoded array of evaluator configurations
          example: '[{"id":"moving-averages","params":{"fastPeriod":50,"slowPeriod":200}}]'

      responses:
        '200':
          description: Historical price data with indicators
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HistoryResponse'

components:
  schemas:
    EvaluatorConfig:
      type: object
      required:
        - id
      properties:
        id:
          type: string
          description: Identifier for the indicator/evaluator
          example: moving-averages
        params:
          type: object
          description: Parameters for indicator calculation
          additionalProperties: true
          example:
            fastPeriod: 50
            slowPeriod: 200

    Evaluation:
      type: object
      required:
        - id
        - values
      properties:
        id:
          type: string
          example: moving-averages
        params:
          type: object
          description: Parameters used for calculation (echo of request)
          additionalProperties: true
        values:
          type: array
          items:
            $ref: '#/components/schemas/IndicatorValue'

    IndicatorValue:
      type: object
      required:
        - name
        - timestamp
        - value
      properties:
        name:
          type: string
          example: ma50
        timestamp:
          type: integer
          format: int64
          description: Unix timestamp in milliseconds (matches parent candle timestamp)
          example: 1704067200000
        value:
          type: number
          format: double
          example: 93439.50
```

---

### Phase 2: Request Parsing

**File:** Request handler / Controller

**Parse evaluators parameter:**

```typescript
// TypeScript example
interface EvaluatorConfig {
  id: string;
  params?: Record<string, any>;
}

function parseEvaluators(queryParam: string | undefined): EvaluatorConfig[] {
  if (!queryParam) {
    return [];
  }

  try {
    const parsed = JSON.parse(queryParam);

    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new Error('Evaluators must be an array');
    }

    // Validate each config
    return parsed.map((config: any) => {
      if (!config.id || typeof config.id !== 'string') {
        throw new Error('Each evaluator must have an id');
      }

      return {
        id: config.id,
        params: config.params || {}
      };
    });
  } catch (error) {
    throw new Error(`Invalid evaluators parameter: ${error.message}`);
  }
}

// Usage in handler
const evaluators = parseEvaluators(req.query.evaluators);
```

**Add validation:**
```typescript
function validateEvaluatorParams(id: string, params: any): void {
  switch (id) {
    case 'moving-averages':
      if (params.fastPeriod !== undefined) {
        if (typeof params.fastPeriod !== 'number' || params.fastPeriod < 1) {
          throw new Error('fastPeriod must be a positive number');
        }
      }
      if (params.slowPeriod !== undefined) {
        if (typeof params.slowPeriod !== 'number' || params.slowPeriod < 1) {
          throw new Error('slowPeriod must be a positive number');
        }
        if (params.fastPeriod && params.slowPeriod <= params.fastPeriod) {
          throw new Error('slowPeriod must be greater than fastPeriod');
        }
      }
      break;

    case 'rsi':
      if (params.period !== undefined) {
        if (typeof params.period !== 'number' || params.period < 2) {
          throw new Error('RSI period must be at least 2');
        }
      }
      break;

    // Add more validators for other indicators
  }
}
```

---

### Phase 3: Evaluator System Refactoring

**Current Problem:** Evaluators likely use hardcoded parameters

**File:** Evaluator implementations

#### 3.1 Create Base Evaluator Interface

```typescript
interface Evaluator {
  id: string;
  defaultParams: Record<string, any>;

  /**
   * Validate parameters for this evaluator
   */
  validateParams(params: Record<string, any>): void;

  /**
   * Evaluate indicator for given candles with custom params
   */
  evaluate(candles: Candle[], params?: Record<string, any>): IndicatorValue[];
}
```

#### 3.2 Refactor Moving Averages Evaluator

**BEFORE (Hardcoded):**
```typescript
class MovingAveragesEvaluator {
  evaluate(candles: Candle[]): IndicatorValue[] {
    const fastMA = this.calculateSMA(candles, 50);  // ❌ Hardcoded
    const slowMA = this.calculateSMA(candles, 200); // ❌ Hardcoded

    return [
      { name: 'fast_ma', value: fastMA },  // ❌ Generic name
      { name: 'slow_ma', value: slowMA }   // ❌ Generic name
    ];
  }
}
```

**AFTER (Configurable):**
```typescript
class MovingAveragesEvaluator implements Evaluator {
  id = 'moving-averages';

  defaultParams = {
    fastPeriod: 50,
    slowPeriod: 200,
    type: 'sma'  // or 'ema'
  };

  validateParams(params: Record<string, any>): void {
    const { fastPeriod, slowPeriod, type } = params;

    if (fastPeriod !== undefined && (typeof fastPeriod !== 'number' || fastPeriod < 1)) {
      throw new Error('fastPeriod must be a positive number');
    }

    if (slowPeriod !== undefined && (typeof slowPeriod !== 'number' || slowPeriod < 1)) {
      throw new Error('slowPeriod must be a positive number');
    }

    if (fastPeriod && slowPeriod && slowPeriod <= fastPeriod) {
      throw new Error('slowPeriod must be greater than fastPeriod');
    }

    if (type !== undefined && !['sma', 'ema'].includes(type)) {
      throw new Error('type must be either "sma" or "ema"');
    }
  }

  evaluate(candles: Candle[], params?: Record<string, any>): IndicatorValue[] {
    // Merge with defaults
    const config = { ...this.defaultParams, ...params };

    // Validate
    this.validateParams(config);

    // Get timestamp from latest candle
    const timestamp = candles[candles.length - 1]?.timestamp || Date.now();

    // Calculate with custom periods
    const fastMA = config.type === 'sma'
      ? this.calculateSMA(candles, config.fastPeriod)
      : this.calculateEMA(candles, config.fastPeriod);

    const slowMA = config.type === 'sma'
      ? this.calculateSMA(candles, config.slowPeriod)
      : this.calculateEMA(candles, config.slowPeriod);

    // ✅ Return period-specific names with timestamp
    return [
      { name: `ma${config.fastPeriod}`, timestamp, value: fastMA },
      { name: `ma${config.slowPeriod}`, timestamp, value: slowMA }
    ];
  }

  private calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) {
      return 0;  // or NaN, or null
    }

    const relevantCandles = candles.slice(-period);
    const sum = relevantCandles.reduce((acc, c) => acc + c.close, 0);
    return sum / period;
  }

  private calculateEMA(candles: Candle[], period: number): number {
    // Implement EMA calculation
    // ...
  }
}
```

#### 3.3 Refactor RSI Evaluator

**BEFORE (Hardcoded):**
```typescript
class RSIEvaluator {
  evaluate(candles: Candle[]): IndicatorValue[] {
    const rsi = this.calculateRSI(candles, 14);  // ❌ Hardcoded period

    return [
      { name: 'rsi', value: rsi }
    ];
  }
}
```

**AFTER (Configurable):**
```typescript
class RSIEvaluator implements Evaluator {
  id = 'rsi';

  defaultParams = {
    period: 14
  };

  validateParams(params: Record<string, any>): void {
    const { period } = params;

    if (period !== undefined && (typeof period !== 'number' || period < 2)) {
      throw new Error('RSI period must be at least 2');
    }
  }

  evaluate(candles: Candle[], params?: Record<string, any>): IndicatorValue[] {
    const config = { ...this.defaultParams, ...params };
    this.validateParams(config);

    // Get timestamp from latest candle
    const timestamp = candles[candles.length - 1]?.timestamp || Date.now();

    const rsi = this.calculateRSI(candles, config.period);

    // Option 1: Period-specific name (if using non-standard period)
    // return [
    //   { name: `rsi${config.period}`, timestamp, value: rsi }
    // ];

    // Option 2: Generic name (recommended for standard period 14)
    return [
      { name: 'rsi', timestamp, value: rsi }
    ];
  }

  private calculateRSI(candles: Candle[], period: number): number {
    // RSI calculation implementation
    // ...
  }
}
```

#### 3.4 MACD Evaluator (Future)

```typescript
class MACDEvaluator implements Evaluator {
  id = 'macd';

  defaultParams = {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9
  };

  validateParams(params: Record<string, any>): void {
    // Validate fast, slow, signal periods
  }

  evaluate(candles: Candle[], params?: Record<string, any>): IndicatorValue[] {
    const config = { ...this.defaultParams, ...params };
    this.validateParams(config);

    // Get timestamp from latest candle
    const timestamp = candles[candles.length - 1]?.timestamp || Date.now();

    const { macd, signal, histogram } = this.calculateMACD(
      candles,
      config.fastPeriod,
      config.slowPeriod,
      config.signalPeriod
    );

    return [
      { name: 'macd', timestamp, value: macd },
      { name: 'macd_signal', timestamp, value: signal },
      { name: 'macd_histogram', timestamp, value: histogram }
    ];
  }

  private calculateMACD(candles: Candle[], fast: number, slow: number, signal: number) {
    // MACD calculation
    // ...
  }
}
```

---

### Phase 4: Orchestration Layer

**File:** History endpoint handler

**Update evaluation orchestration:**

```typescript
async function getHistory(req, res) {
  const { symbol, interval, startTime, endTime } = req.query;

  // Parse evaluators with params
  const evaluatorConfigs = parseEvaluators(req.query.evaluators);

  // Fetch candles
  const candles = await fetchCandles(symbol, interval, startTime, endTime);

  // Evaluate indicators
  const evaluations = [];

  for (const config of evaluatorConfigs) {
    const evaluator = getEvaluator(config.id);

    if (!evaluator) {
      throw new Error(`Unknown evaluator: ${config.id}`);
    }

    try {
      // Validate params
      evaluator.validateParams(config.params || {});

      // Calculate indicators
      const values = evaluator.evaluate(candles, config.params);

      // Build response with params echo
      evaluations.push({
        id: config.id,
        params: { ...evaluator.defaultParams, ...config.params },  // Echo merged params
        values
      });
    } catch (error) {
      throw new Error(`Error evaluating ${config.id}: ${error.message}`);
    }
  }

  res.json({
    candles: candles.map(serializeCandle),
    evaluations
  });
}
```

---

### Phase 5: Evaluator Registry

**File:** Evaluator registry

```typescript
class EvaluatorRegistry {
  private evaluators = new Map<string, Evaluator>();

  register(evaluator: Evaluator): void {
    this.evaluators.set(evaluator.id, evaluator);
  }

  get(id: string): Evaluator | undefined {
    return this.evaluators.get(id);
  }

  getAll(): Evaluator[] {
    return Array.from(this.evaluators.values());
  }
}

// Initialize registry
const registry = new EvaluatorRegistry();
registry.register(new MovingAveragesEvaluator());
registry.register(new RSIEvaluator());
registry.register(new MACDEvaluator());
// ... register more evaluators

export function getEvaluator(id: string): Evaluator | undefined {
  return registry.get(id);
}
```

---

### Phase 6: Error Handling

**Add comprehensive error responses:**

```typescript
// Invalid JSON
{
  "error": "Invalid evaluators parameter: Unexpected token",
  "code": "INVALID_EVALUATORS_FORMAT"
}

// Missing required param
{
  "error": "evaluator 'moving-averages': slowPeriod must be greater than fastPeriod",
  "code": "INVALID_EVALUATOR_PARAMS"
}

// Unknown evaluator
{
  "error": "Unknown evaluator: bollinger-bands",
  "code": "UNKNOWN_EVALUATOR",
  "availableEvaluators": ["moving-averages", "rsi", "macd"]
}

// Invalid param value
{
  "error": "evaluator 'rsi': period must be at least 2",
  "code": "INVALID_PARAM_VALUE"
}
```

---

### Phase 7: Default Behavior

**Handle missing params gracefully:**

```typescript
// Request with no params - use defaults
GET /history?symbol=BTC-USD&evaluators=[{"id":"moving-averages"}]

// Response - uses default params
{
  "evaluations": [{
    "id": "moving-averages",
    "params": {
      "fastPeriod": 50,    // ← defaults applied
      "slowPeriod": 200,
      "type": "sma"
    },
    "values": [...]
  }]
}

// Partial params - merge with defaults
GET /history?symbol=BTC-USD&evaluators=[{"id":"moving-averages","params":{"fastPeriod":20}}]

// Response
{
  "evaluations": [{
    "id": "moving-averages",
    "params": {
      "fastPeriod": 20,     // ← from request
      "slowPeriod": 200,    // ← default
      "type": "sma"         // ← default
    },
    "values": [...]
  }]
}
```

---

## Testing Plan

### Unit Tests

**Test evaluator parameter handling:**
```typescript
describe('MovingAveragesEvaluator', () => {
  it('uses default params when none provided', () => {
    const evaluator = new MovingAveragesEvaluator();
    const result = evaluator.evaluate(mockCandles);

    expect(result).toContainEqual({
      name: 'ma50',
      timestamp: expect.any(Number),
      value: expect.any(Number)
    });
    expect(result).toContainEqual({
      name: 'ma200',
      timestamp: expect.any(Number),
      value: expect.any(Number)
    });
  });

  it('uses custom params when provided', () => {
    const evaluator = new MovingAveragesEvaluator();
    const result = evaluator.evaluate(mockCandles, {
      fastPeriod: 20,
      slowPeriod: 100
    });

    expect(result).toContainEqual({
      name: 'ma20',
      timestamp: expect.any(Number),
      value: expect.any(Number)
    });
    expect(result).toContainEqual({
      name: 'ma100',
      timestamp: expect.any(Number),
      value: expect.any(Number)
    });
  });

  it('validates param constraints', () => {
    const evaluator = new MovingAveragesEvaluator();

    expect(() => {
      evaluator.evaluate(mockCandles, { fastPeriod: -5 });
    }).toThrow('fastPeriod must be a positive number');

    expect(() => {
      evaluator.evaluate(mockCandles, { fastPeriod: 100, slowPeriod: 50 });
    }).toThrow('slowPeriod must be greater than fastPeriod');
  });
});
```

### Integration Tests

**Test full request flow:**
```typescript
describe('GET /history with evaluators', () => {
  it('returns indicators with custom params', async () => {
    const response = await request(app)
      .get('/history')
      .query({
        symbol: 'BTC-USD',
        interval: 'ONE_HOUR',
        startTime: 1704067200000,
        endTime: 1704153600000,
        evaluators: JSON.stringify([{
          id: 'moving-averages',
          params: { fastPeriod: 20, slowPeriod: 100 }
        }])
      });

    expect(response.status).toBe(200);
    expect(response.body.candles).toHaveLength(expect.any(Number));

    // Check first candle has evaluations
    const firstCandle = response.body.candles[0];
    expect(firstCandle.evaluations).toHaveLength(1);
    expect(firstCandle.evaluations[0]).toMatchObject({
      id: 'moving-averages',
      params: { fastPeriod: 20, slowPeriod: 100, type: 'sma' },
      values: expect.arrayContaining([
        { name: 'ma20', timestamp: firstCandle.timestamp, value: expect.any(Number) },
        { name: 'ma100', timestamp: firstCandle.timestamp, value: expect.any(Number) }
      ])
    });
  });

  it('returns error for invalid params', async () => {
    const response = await request(app)
      .get('/history')
      .query({
        symbol: 'BTC-USD',
        interval: 'ONE_HOUR',
        evaluators: JSON.stringify([{
          id: 'rsi',
          params: { period: -10 }
        }])
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('period must be at least 2');
  });
});
```

### Manual Testing

**Test with curl:**
```bash
# Test with default params
curl "http://localhost:8080/history?symbol=BTC-USD&interval=ONE_HOUR&startTime=1704067200000&endTime=1704153600000&evaluators=%5B%7B%22id%22%3A%22moving-averages%22%7D%5D"

# Test with custom params
curl "http://localhost:8080/history?symbol=BTC-USD&interval=ONE_HOUR&startTime=1704067200000&endTime=1704153600000&evaluators=%5B%7B%22id%22%3A%22moving-averages%22%2C%22params%22%3A%7B%22fastPeriod%22%3A20%2C%22slowPeriod%22%3A100%7D%7D%5D"

# Test with multiple evaluators
curl "http://localhost:8080/history?symbol=BTC-USD&interval=ONE_HOUR&startTime=1704067200000&endTime=1704153600000&evaluators=%5B%7B%22id%22%3A%22moving-averages%22%2C%22params%22%3A%7B%22fastPeriod%22%3A20%2C%22slowPeriod%22%3A100%7D%7D%2C%7B%22id%22%3A%22rsi%22%2C%22params%22%3A%7B%22period%22%3A14%7D%7D%5D"
```

---

## Default Parameters Reference

**Standard indicator defaults:**

| Indicator | Parameters | Defaults |
|-----------|------------|----------|
| Moving Averages | fastPeriod, slowPeriod, type | 50, 200, 'sma' |
| RSI | period | 14 |
| MACD | fastPeriod, slowPeriod, signalPeriod | 12, 26, 9 |
| Bollinger Bands | period, stdDev | 20, 2 |
| Stochastic | kPeriod, dPeriod, smooth | 14, 3, 3 |
| ATR | period | 14 |
| ADX | period | 14 |

---

## Performance Considerations

1. **Caching:** Consider caching indicator calculations for common parameter combinations
2. **Computation Limits:** Set max period limits to prevent excessive computation
3. **Rate Limiting:** More complex than simple evaluator lists - consider request complexity
4. **Batch Processing:** Calculate all indicators in single pass over candles when possible

---

## Migration Notes

**No backward compatibility needed** - Clean break is acceptable per requirements.

**Before deployment:**
1. ✅ Update OpenAPI spec
2. ✅ Deploy server changes
3. ✅ Update client apps (sc-app, rs-charts)
4. ✅ Update any documentation

**Deployment order:**
1. Deploy Market API Server with new parameter support
2. Deploy sc-app with evaluator config changes
3. Deploy rs-charts with evaluator config changes

---

## Success Criteria

✅ API accepts `evaluators` as JSON array with params
✅ Each evaluator validates its parameters
✅ Indicators calculated with custom parameters
✅ Response includes period-specific names (ma20, ma100, etc.)
✅ Response echoes parameters used in calculations
✅ **Each indicator value includes timestamp matching parent candle**
✅ **Evaluations nested within each candle object (not separate array)**
✅ Invalid params return clear error messages
✅ Default params applied when not specified
✅ Multiple evaluators with different params work together
✅ Performance acceptable for typical requests

---

## Estimated Effort

**Server-Side Implementation: 6-8 hours**

1. OpenAPI spec update - 30 min
2. Request parsing & validation - 1 hour
3. Refactor evaluators for params - 3 hours
4. Orchestration updates - 1 hour
5. Error handling - 1 hour
6. Testing - 2 hours
7. Documentation - 30 min

---

## Files to Modify (Server-Side)

1. **openapi.yaml** - Update API contract
2. **request-handler.ts** - Parse evaluators JSON
3. **evaluators/moving-averages.ts** - Accept params
4. **evaluators/rsi.ts** - Accept params
5. **evaluators/macd.ts** - Accept params (if exists)
6. **evaluators/base.ts** - Define Evaluator interface
7. **evaluators/registry.ts** - Evaluator management
8. **history-handler.ts** - Orchestrate evaluation with params
9. **validation.ts** - Parameter validation logic
10. **tests/** - Unit and integration tests

---

## Next Steps

1. Review and approve this plan
2. Implement server-side changes
3. Deploy to staging environment
4. Test with manual curl requests
5. Verify indicator calculations are correct
6. Deploy to production
7. Proceed with client-side changes (see INDICATOR_PARAMETERS_IMPLEMENTATION.md)
