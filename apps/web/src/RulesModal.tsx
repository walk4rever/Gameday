interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-header">
          <h2>🎴 掼蛋规则速查指南</h2>
          <button className="rules-close-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="rules-content">
          <section className="rules-section">
            <h3>👥 阵容与目标</h3>
            <p>
              四人分两队，<strong>对门为搭档</strong>（你与上方是队友，左右两人是对家）。
              只要你或队友率先出完全部手牌，即可争取胜利升级！
            </p>
          </section>

          <section className="rules-section">
            <h3>💣 炸弹体系（由大到小）</h3>
            <div className="rules-tier-list">
              <div className="tier-item tier-god">
                <span className="tier-rank">No.1</span>
                <span className="tier-title">四大天王</span>
                <span className="tier-desc">四张王牌（两张大王 + 两张小王），最大王炸！</span>
              </div>
              <div className="tier-item">
                <span className="tier-rank">No.2</span>
                <span className="tier-title">八张 / 七张 / 六张炸弹</span>
                <span className="tier-desc">张数越多炸弹越大。</span>
              </div>
              <div className="tier-item tier-highlight">
                <span className="tier-rank">No.3</span>
                <span className="tier-title">同花顺</span>
                <span className="tier-desc">同一花色的 5 张连续顺子，压制 5 张炸弹！</span>
              </div>
              <div className="tier-item">
                <span className="tier-rank">No.4</span>
                <span className="tier-title">五张炸弹 &gt; 四张炸弹</span>
                <span className="tier-desc">同张数按点数比大小。</span>
              </div>
            </div>
          </section>

          <section className="rules-section">
            <h3>🃏 常见常规牌型</h3>
            <ul className="rules-card-types">
              <li>
                <strong>单张 / 对子 / 三张</strong>：任意 1、2、3 张同点数牌。
              </li>
              <li>
                <strong>三带二（5张）</strong>：三个同点数 + 一个对子（如 888 + 55）。
              </li>
              <li>
                <strong>顺子（固定5张）</strong>：五张连续单牌（如 6-7-8-9-10），A 可做 A2345 或 10JQKA。
              </li>
              <li>
                <strong>三连对 / 木板（6张）</strong>：三个连续对子（如 77-88-99）。
              </li>
              <li>
                <strong>三同连张 / 钢板（6张）</strong>：两个连续三张（如 777-888）。
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3>⭐ 级牌与逢人配</h3>
            <p>
              <strong>当前级牌</strong>：打几级，该点数即为级牌（如打 2 时，2 大于 A，仅次于小王）。
            </p>
            <p>
              <strong>红桃逢人配</strong>：红桃级牌（红心配牌）为万能百搭牌！
              可以当做任意普通牌组成顺子、炸弹或连对，威力强大。
            </p>
          </section>

          <section className="rules-section">
            <h3>🏆 胜负与升级</h3>
            <ul className="rules-scores">
              <li>
                <strong>双上（+3级）</strong>：我方搭档包揽头游与二游，获得大胜！
              </li>
              <li>
                <strong>单上（+1级）</strong>：我方获得头游与三游，稳稳升 1 级。
              </li>
              <li>
                <strong>平局（不升级）</strong>：我方虽得头游，但搭档为末游，双方打平。
              </li>
            </ul>
          </section>
        </div>

        <div className="rules-footer">
          <button className="primary-action-btn" onClick={onClose}>
            我知道了，回牌桌
          </button>
        </div>
      </div>
    </div>
  );
}
