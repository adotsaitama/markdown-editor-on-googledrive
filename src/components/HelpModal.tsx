import { useEffect } from "react";
import { EDITOR_COMMANDS, type EditorCommand } from "../lib/editorCommands";
import { formatShortcut, getShortcuts } from "../lib/shortcutConfig";

interface HelpModalProps {
  onClose: () => void;
}

/**
 * Usage guide + keyboard shortcut reference. The shortcut table is derived
 * from the shortcut config, so future user customizations show up here
 * automatically.
 */
export function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shortcuts = getShortcuts();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="ヘルプ"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>ヘルプ</h2>
          <button className="icon-button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body modal-columns">
          <section>
            <h3>このエディタについて</h3>
          <p>
            Google Drive の「アプリで開く」から <code>.md</code> ファイルを開いて、
            閲覧・編集・上書き保存できる Markdown エディタです。
          </p>
          <ul>
            <li>
              <strong>表示モード</strong>: ヘッダ右のアイコンで 編集 / 分割 / 表示 を切替。
              分割表示ではエディタとプレビューのスクロールが同期します。
            </li>
            <li>
              <strong>保存</strong>: 保存ボタンまたはショートカットで Drive
              に上書き保存。過去の版は Drive の「版を管理」から参照できます。
            </li>
            <li>
              <strong>画像</strong>: スクリーンショットをエディタに貼り付けると、同じフォルダの{" "}
              <code>images/</code> に保存され、相対パス（<code>![](images/...)</code>）
              で参照されます。ローカルに同期しても他のツールでそのまま表示できます。
            </li>
            <li>
              <strong>テーブル</strong>: ツールバーの表アイコンからサイズを選んで空のテーブルを挿入。
            </li>
            <li>
              <strong>Mermaid</strong>: <code>```mermaid</code> のコードブロックはプレビューで図として描画されます。
            </li>
            <li>
              <strong>インライン編集</strong>: 表示モードでブロックを<strong>ダブルクリック</strong>すると、
              その場でソースを編集できます（書式ボタン・ショートカットも使用可）。
            </li>
            <li>
              <strong>Lint</strong>: 画面下部に markdownlint の結果を件数表示。
              クリックで詳細パネルが開き、各項目から該当行へジャンプできます。
            </li>
            <li>
              <strong>整形</strong>: 🪄 ボタンで Prettier による文書全体の整形（元に戻す可能）。
            </li>
          </ul>
          </section>

          <section>
            <h3>キーボードショートカット</h3>
          <table className="shortcut-table">
            <tbody>
              {EDITOR_COMMANDS.filter((c) => shortcuts[c.id]).map((entry) => {
                const c = entry as EditorCommand;
                return (
                  <tr key={c.id}>
                    <td>
                      <kbd>{formatShortcut(shortcuts[entry.id])}</kbd>
                    </td>
                    <td>
                      {c.label}
                      {c.hint ? `（${c.hint}）` : ""}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>
                </td>
                <td>リスト項目のインデント / 解除</td>
              </tr>
            </tbody>
          </table>
            <p className="help-note">
              ショートカットの割り当ては設定として管理されています（将来のバージョンでカスタマイズに対応予定）。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
