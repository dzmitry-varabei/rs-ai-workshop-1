import type { UserStatsResponse } from '@english-learning/database-client';
import './StatsPanel.css';

interface StatsPanelProps {
  stats: UserStatsResponse;
  currentProgress: number;
  totalInBatch: number;
}

export function StatsPanel({ stats, currentProgress, totalInBatch }: StatsPanelProps) {
  const progressPercentage = totalInBatch > 0 ? (currentProgress / totalInBatch) * 100 : 0;

  return (
    <div className="stats-panel">
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-text">
          {currentProgress} / {totalInBatch}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">Total Seen</div>
          <div className="stat-value">{stats.totalSeen}</div>
        </div>
        <div className="stat-item stat-known">
          <div className="stat-label">Known</div>
          <div className="stat-value">{stats.known}</div>
        </div>
        <div className="stat-item stat-unknown">
          <div className="stat-label">Unknown</div>
          <div className="stat-value">{stats.unknown}</div>
        </div>
        <div className="stat-item stat-percentage">
          <div className="stat-label">Knowledge</div>
          <div className="stat-value">{stats.knowledgePercentage}%</div>
        </div>
      </div>
    </div>
  );
}

