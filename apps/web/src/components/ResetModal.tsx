import './ResetModal.css';

interface ResetModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetModal({ isOpen, onConfirm, onCancel }: ResetModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Reset Progress</h2>
        <p>Are you sure you want to reset all your progress?</p>
        <p className="modal-warning">
          This will delete all your word states and statistics. This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="modal-button modal-button-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-button modal-button-confirm" onClick={onConfirm}>
            Reset Progress
          </button>
        </div>
      </div>
    </div>
  );
}

