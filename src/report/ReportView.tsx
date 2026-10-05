/**
 * The client report document: an A4, print-ready proposal rendered from
 * `ReportModel` (itself built on `buildBillOfMaterials`). It calculates nothing.
 *
 *   Cover · 1 Summary · 2 Site map · 3 Areas · 4 Recording, network and cabling
 *   · 5 Bill of materials · 6 Datasheets · 7 Assumptions and notes · 8 Approval
 */

import './report.css';

import type { ReactNode } from 'react';

import { COMPANY_NAME, LOGO_INTRINSIC, LOGO_LIGHT_URL } from '../brand.ts';
import { CATEGORY_LABEL, formatMoney } from '../ui/format.ts';
import { QrSvg, ReportMap } from './ReportParts.tsx';
import { longDate, type ReportModel } from './reportModel.ts';
import { SignOff } from './SignOff.tsx';

function Section({ n, title, children, pageBreak = true }: { n: number; title: string; children: ReactNode; pageBreak?: boolean }) {
  return (
    <section className={`report-section ${pageBreak ? 'page-break' : ''}`} aria-labelledby={`report-s${n}`}>
      <h2 id={`report-s${n}`}>
        <span className="report-num">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ReportView({ model }: { model: ReportModel }) {
  const m = model;
  const status = m.final ? 'Final' : 'Draft — not for approval';
  const cur = m.prices.currency;
  return (
    <article className="report" aria-label="Client report" data-status={m.final ? 'final' : 'draft'}>
      {!m.final && (
        <div className="report-watermark" aria-hidden="true">
          <span>DRAFT — NOT FOR APPROVAL</span>
        </div>
      )}
      <table className="report-frame" role="presentation">
        <thead>
          <tr>
            <td>
              <div className="report-running-header">
                <img src={LOGO_LIGHT_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} />
                <span>
                  CCTV proposal — {m.projectName} · {status}
                </span>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {/* --- cover ------------------------------------------------------- */}
              <section className="report-cover" aria-label="Cover">
                <div>
                  {!m.final && <div className="report-draft-ribbon">DRAFT — NOT FOR APPROVAL</div>}
                  <img className="cover-logo" src={LOGO_LIGHT_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} />
                  <h1 className="cover-title">CCTV system proposal</h1>
                  <p className="cover-project">{m.projectName}</p>
                  <div className="cover-band" />
                </div>
                <dl>
                  <dt>Prepared for</dt>
                  <dd>
                    {m.clientName || '—'}
                    {m.clientContact && <span className="muted"> · {m.clientContact}</span>}
                  </dd>
                  <dt>Prepared by</dt>
                  <dd>
                    {COMPANY_NAME}
                    {m.preparedBy.name && ` — ${m.preparedBy.name}`}
                    {m.preparedBy.title && <span className="muted">, {m.preparedBy.title}</span>}
                    {(m.preparedBy.phone || m.preparedBy.email) && (
                      <span className="muted"> · {[m.preparedBy.phone, m.preparedBy.email].filter(Boolean).join(' · ')}</span>
                    )}
                  </dd>
                  <dt>Date</dt>
                  <dd>{longDate(m.date)}</dd>
                  <dt>Status</dt>
                  <dd>{m.final ? `Final — valid until ${longDate(m.validUntil)}` : 'Draft for discussion — preliminary until the site survey'}</dd>
                </dl>
              </section>

              <Section n={1} title="Summary">
                <p>{m.summary}</p>
                <dl className="report-facts">
                  {m.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>

              <Section n={2} title="Site map">
                {m.map ? (
                  <ReportMap view={m.map} image={m.planImage} />
                ) : (
                  <p className="muted">No site plan has been added yet. Camera positions will be marked on the plan after the site survey.</p>
                )}
              </Section>

              <Section n={3} title="Camera for each area">
                {m.areas.map((a) => (
                  <div key={a.locationId} className="report-area">
                    <h3>
                      {a.name} <span className="muted">· {a.cameraCount} camera{a.cameraCount === 1 ? '' : 's'}</span>
                    </h3>
                    <p className="report-asked">
                      <span className="small muted">{a.fromIntake ? 'What you asked for' : 'What it needs to do'}: </span>
                      {a.asked}
                    </p>
                    {a.camera ? (
                      <>
                        <p>
                          <strong>{a.camera.model}</strong> — {a.camera.marketingName}, {a.camera.lens}.
                        </p>
                        <p>
                          <strong>Why this camera: </strong>
                          {a.why}
                        </p>
                        {a.spec && (
                          <table className="report-table">
                            <caption className="sr-only">Specification for {a.camera.model}</caption>
                            <tbody>
                              {a.spec.map((f) => (
                                <tr key={f.name}>
                                  <th scope="row">{f.name}</th>
                                  <td>{f.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    ) : (
                      <p>{a.why}</p>
                    )}
                  </div>
                ))}
              </Section>

              <Section n={4} title="Recording, network and cabling">
                <h3>Recording</h3>
                <p>{m.system.recorder ? <strong>{m.system.recorder}</strong> : 'The recorder is still to be chosen.'}</p>
                {m.system.recorderDetail && <p className="muted">{m.system.recorderDetail}</p>}
                {m.system.storage && <p>Hard drives: {m.system.storage}</p>}
                <p>Recordings are kept for {m.system.retention}.</p>
                <h3 style={{ marginTop: '10pt' }}>Network and power</h3>
                <p>{m.system.power}</p>
                {m.system.switches.length > 0 && (
                  <ul>
                    {m.system.switches.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                <h3 style={{ marginTop: '10pt' }}>Cabling</h3>
                {m.system.cabling.length ? (
                  <ul>
                    {m.system.cabling.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No cable runs yet.</p>
                )}
                {m.system.fibreOrLongRuns.length > 0 ? (
                  <>
                    <p>
                      <strong>Long runs that need fibre or an extender:</strong>
                    </p>
                    <ul>
                      {m.system.fibreOrLongRuns.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Every cable run is within the 90 m limit for standard network cable; no fibre or extenders are needed.</p>
                )}
              </Section>

              <Section n={5} title="Bill of materials">
                <table className="report-table">
                  <caption className="sr-only">Bill of materials</caption>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Description</th>
                      <th scope="col" className="num">
                        Qty
                      </th>
                      {m.prices.priced && (
                        <>
                          <th scope="col" className="num">
                            Unit price{cur ? ` (${cur})` : ''}
                          </th>
                          <th scope="col" className="num">
                            Total{cur ? ` (${cur})` : ''}
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {m.bom.lines.map((l) => {
                      const price = m.prices.unit[l.id];
                      return (
                        <tr key={l.id}>
                          <td>
                            <span className="small muted">{CATEGORY_LABEL[l.category]}</span>
                            <br />
                            <strong>{l.model ? `${l.manufacturer ?? ''} ${l.model}`.trim() : 'Generic'}</strong>
                          </td>
                          <td>{l.description}</td>
                          <td className="num">
                            {l.quantity} {l.unit === 'each' ? '' : l.unit}
                          </td>
                          {m.prices.priced && (
                            <>
                              <td className="num">{price === undefined ? '—' : formatMoney(price)}</td>
                              <td className="num">{price === undefined ? '—' : formatMoney(price * l.quantity)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {m.prices.priced && (
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={4} className="num">
                          Total{cur ? ` (${cur})` : ''}
                          {m.prices.pricedLines < m.bom.lines.length && ` — ${m.prices.pricedLines} of ${m.bom.lines.length} lines priced`}
                        </th>
                        <td className="num">
                          <strong>{formatMoney(m.prices.total)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {!m.prices.priced && <p className="small muted" style={{ marginTop: '6pt' }}>Prices are quoted separately.</p>}
              </Section>

              <Section n={6} title="Datasheets">
                <p className="muted">The official manufacturer datasheet for every product, with a code to scan from the printed page.</p>
                <ul className="report-qr-list" style={{ listStyle: 'none', padding: 0 }}>
                  {m.datasheets.map((d) => (
                    <li key={d.url} className="report-qr-item">
                      <QrSvg text={d.url} label={`QR code for the ${d.model} datasheet`} />
                      <div>
                        <strong>
                          {d.manufacturer} {d.model}
                        </strong>
                        <p className="small" style={{ margin: 0 }}>
                          {d.description}
                        </p>
                        <a className="url" href={d.url}>
                          {d.url}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section n={7} title="Assumptions and notes">
                <h3>To be confirmed on site</h3>
                <ul>
                  {m.notes.toConfirmOnSite.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                {m.notes.unverified.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '8pt' }}>Figures that are estimates</h3>
                    <ul>
                      {m.notes.unverified.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                {m.notes.incomplete.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '8pt' }}>Still open in the design</h3>
                    <ul>
                      {m.notes.incomplete.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                <h3 style={{ marginTop: '8pt' }}>Validity</h3>
                <p>
                  {m.final
                    ? `This proposal is valid for ${m.validityDays} days from ${longDate(m.date)}, until ${longDate(m.validUntil)}.`
                    : 'This is a draft. Validity and prices are set when the proposal is issued as final.'}{' '}
                  Product specifications are taken from the manufacturers’ datasheets linked above.
                </p>
              </Section>

              <Section n={8} title="Approval">
                <SignOff final={m.final} preparedBy={m.preparedBy} date={m.date} clientName={m.clientName} />
              </Section>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
