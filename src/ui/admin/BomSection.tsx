/**
 * Bill of materials (Admin): every line `buildBillOfMaterials` returns, with
 * its datasheet, estimate and attention flags, and whether the BOM is complete.
 *
 * Prices are optional and only ever what the engineer types: no price is
 * looked up or invented. A line without a price is left blank, and the total
 * says how many lines it covers.
 */

import type { BillOfMaterials } from '../../engine/billOfMaterials.ts';
import { CATEGORY_LABEL, formatMoney } from '../format.ts';
import type { ProjectExtras } from '../../state/workspace.ts';
import { Icon } from '../icons.tsx';
import { Card, EstimateBadge, Notice, NumberInput, TextField } from '../primitives.tsx';

const inputClass =
  'w-28 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-right text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none';

export function BomSection({ bom, extras, onExtras }: { bom: BillOfMaterials; extras: ProjectExtras; onExtras: (next: ProjectExtras) => void }) {
  const priced = bom.lines.filter((l) => extras.prices[l.id] !== undefined);
  const total = priced.reduce((sum, l) => sum + (extras.prices[l.id] ?? 0) * l.quantity, 0);
  const cur = extras.currency.trim();
  const setPrice = (id: string, v: number, raw: string) => {
    const prices = { ...extras.prices };
    if (raw.trim() === '') delete prices[id];
    else if (Number.isFinite(v) && v >= 0 && v <= 1e9) prices[id] = v;
    else return;
    onExtras({ ...extras, prices });
  };

  return (
    <div className="grid gap-4">
      {bom.complete ? (
        <Notice kind="success" title="Complete">Every location has a camera, and the recorder, drives, switches and cable are all designed.</Notice>
      ) : (
        <Notice kind="error" role="status" title="Incomplete — something could not be designed">
          <ul className="list-disc pl-4">
            {bom.incompleteReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Card title={`${bom.lines.length} lines`} subtitle="Product lines link to the manufacturer datasheet they were read from. Commodity lines (cable, connectors, patch cords, fibre) have no datasheet by design." flush>
        <div className="relative overflow-x-auto max-sm:px-4">
          <table className="stack-table w-full text-left text-sm sm:min-w-[760px]">
            <caption className="sr-only">Bill of materials</caption>
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-ink-3)]">
              <tr>
                <th scope="col" className="px-4 py-2">Item</th>
                <th scope="col" className="px-2 py-2 text-right">Qty</th>
                <th scope="col" className="px-2 py-2">Unit</th>
                <th scope="col" className="px-2 py-2">Datasheet</th>
                <th scope="col" className="px-2 py-2 text-right">Unit price{cur ? ` (${cur})` : ''}</th>
                <th scope="col" className="px-4 py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {bom.lines.map((l, i) => {
                const newGroup = i === 0 || bom.lines[i - 1]?.category !== l.category;
                const price = extras.prices[l.id];
                const name = l.model ?? l.description;
                return (
                  <tr key={l.id} className={`align-top ${newGroup ? 'border-t-2 border-[var(--color-border)]' : 'border-t border-[var(--color-border)]'}`}>
                    <th scope="row" className="px-4 py-2 font-normal max-sm:pt-2">
                      {newGroup && <span className="mb-1 block text-2xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">{CATEGORY_LABEL[l.category]}</span>}
                      <span className="block font-semibold text-[var(--color-ink)]">
                        {l.manufacturer ? `${l.manufacturer} ` : ''}
                        {l.model ?? 'Generic'}
                      </span>
                      <span className="block text-[var(--color-ink-2)]">{l.description}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {l.isEstimate && <EstimateBadge title="The quantity depends on an estimated figure (a placeholder run, the routing factor or an estimated bitrate)." />}
                        {l.flagged && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-marginal-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-marginal)]">
                            <Icon name="alert" size={12} />
                            Check before ordering
                          </span>
                        )}
                      </span>
                      {l.notes.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-[var(--color-accent)]">Notes</summary>
                          <ul className="mt-1 grid gap-0.5 text-xs text-[var(--color-ink-2)]">
                            {l.notes.map((n) => (
                              <li key={n}>{n}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </th>
                    <td data-label="Quantity" className="px-2 py-2 text-right font-mono text-[var(--color-ink)]">{l.quantity}</td>
                    <td data-label="Unit" className="px-2 py-2 text-[var(--color-ink-2)]">{l.unit}</td>
                    <td data-label="Datasheet" className="px-2 py-2">
                      {l.datasheetUrl ? (
                        <a href={l.datasheetUrl} target="_blank" rel="noreferrer noopener" className="text-[var(--color-accent)] underline">
                          PDF
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-3)]">generic</span>
                      )}
                      {l.verifiedOn && <span className="block text-2xs text-[var(--color-ink-3)]">verified {l.verifiedOn}</span>}
                    </td>
                    <td data-label={`Unit price${cur ? ` (${cur})` : ''}`} className="px-2 py-2 text-right">
                      <NumberInput
                        min={0}
                        step={0.01}
                        placeholder="—"
                        aria-label={`Unit price for ${name}`}
                        className={inputClass}
                        value={price ?? Number.NaN}
                        onValueChange={(v, raw) => setPrice(l.id, v, raw)}
                      />
                    </td>
                    <td data-label="Line total" className="px-4 py-2 text-right font-mono text-[var(--color-ink)]">{price === undefined ? '—' : formatMoney(price * l.quantity)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-[var(--color-border-strong)]">
              <tr>
                <th scope="row" colSpan={5} className="px-4 py-2 text-right text-sm font-semibold text-[var(--color-ink)]">
                  Total{cur ? ` (${cur})` : ''} — {priced.length} of {bom.lines.length} lines priced
                </th>
                <td data-label="Total" className="px-4 py-2 text-right font-mono font-semibold text-[var(--color-ink)]">{priced.length ? formatMoney(total) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Prices" subtitle="Optional. Type unit prices in the table above; they appear in the report only when at least one line is priced.">
        <div className="grid max-w-md gap-3 sm:grid-cols-2">
          <TextField
            label="Currency"
            helper="Shown in the column headers, e.g. SAR, AED, USD."
            value={extras.currency}
            onChange={(currency) => onExtras({ ...extras, currency: currency.slice(0, 12) })}
          />
        </div>
        {priced.length > 0 && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[var(--color-fail)] hover:underline"
            onClick={() => onExtras({ ...extras, prices: {} })}
          >
            Clear all prices
          </button>
        )}
      </Card>
    </div>
  );
}
