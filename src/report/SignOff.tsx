/**
 * The approval block on the report's last page — and the only place in the app
 * that uses the ContracTech company stamp. The stamp is the company's mark of
 * commitment, so it appears only on a report the engineer has deliberately made
 * Final (behind a confirmation in Admin → Report); a draft shows why it has none.
 */

import { COMPANY_NAME, STAMP_URL } from '../brand.ts';
import type { EngineerProfile } from '../state/engineerProfile.ts';
import { longDate } from './reportModel.ts';

export function SignOff({ final, preparedBy, date, clientName }: { final: boolean; preparedBy: EngineerProfile; date: string; clientName: string }) {
  return (
    <div className="report-signoff">
      <div>
        <h3>Prepared by {COMPANY_NAME}</h3>
        <p>
          {preparedBy.name || <span className="muted">Engineer’s name</span>}
          {preparedBy.title && <span className="muted"> — {preparedBy.title}</span>}
        </p>
        {(preparedBy.phone || preparedBy.email) && <p className="small muted">{[preparedBy.phone, preparedBy.email].filter(Boolean).join(' · ')}</p>}
        <p className="small">Date: {longDate(date)}</p>
        <div className="signature-area">
          <div className="signature-line" />
          <div className="signature-caption">Signature</div>
          {final && <img className="report-stamp" src={STAMP_URL} alt={`${COMPANY_NAME} company stamp`} data-testid="company-stamp" />}
        </div>
        {!final && <p className="small muted">Draft: the company stamp is applied only when the report is issued as final.</p>}
      </div>
      <div>
        <h3>Accepted for the client</h3>
        <p>{clientName || <span className="muted">Client name</span>}</p>
        <p className="small">Date: ____________________</p>
        <div className="signature-area">
          <div className="signature-line" />
          <div className="signature-caption">Signature</div>
        </div>
      </div>
    </div>
  );
}
