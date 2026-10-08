import { APP_NAME, S } from '../../strings';
import { isIos, isSafari } from '../hooks';

export function InstallGate({ allowContinue, onContinue }: { allowContinue: boolean; onContinue: () => void }) {
  const ios = isIos();
  const safari = isSafari();
  return (
    <div className="gate fade-in">
      <img className="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
      <h1>{APP_NAME}</h1>
      <h2>{S.install.title}</h2>
      <p className="muted">{S.install.intro}</p>
      {ios && !safari ? <p className="card-warning">{S.install.notSafari}</p> : null}
      <ol>
        <li>
          <span className="num">1</span>
          <span>
            {S.install.step1} <span aria-hidden="true">⬆️</span>
          </span>
        </li>
        <li>
          <span className="num">2</span>
          <span>
            {S.install.step2} <span aria-hidden="true">➕</span>
          </span>
        </li>
        <li>
          <span className="num">3</span>
          <span>{S.install.step3}</span>
        </li>
      </ol>
      {allowContinue ? (
        <button type="button" className="btn btn-ghost" onClick={onContinue}>
          {S.install.continueAnyway}
        </button>
      ) : null}
    </div>
  );
}
