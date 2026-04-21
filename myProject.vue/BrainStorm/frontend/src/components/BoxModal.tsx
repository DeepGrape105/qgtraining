import type { GraphItem } from '../types';

// 定义本地类型
interface GraphItem {
  id: string;
  title: string;
  createdAt: string;
}

interface BoxModalProps {
  title: string;
  list: GraphItem[];
  boxType: string;
  show: boolean;
  onClose: () => void;
  onLoad: (id: string, boxType: string) => void;
  onMoveToRecycle?: (id: string, title: string, boxType: string) => void;
  onRestore?: (id: string, title: string) => void;
  onPermanentDelete?: (id: string, title: string) => void;
}

export const BoxModal = ({
  title,
  list,
  boxType,
  show,
  onClose,
  onLoad,
  onMoveToRecycle,
  onRestore,
  onPermanentDelete,
}: BoxModalProps) => {
  if (!show) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, minWidth: 450, maxWidth: 650, maxHeight: '80vh', overflow: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#666',
              padding: '4px 8px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            ✕
          </button>
        </div>

        {list.length === 0 ? (
          <p style={{ color: '#999' }}>暂无内容</p>
        ) : (
          list.map((item) => (
            <div
              key={item.id}
              style={{ padding: 12, marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}
            >
              <div><strong>{item.title}</strong></div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>ID: {item.id} | {new Date(item.createdAt).toLocaleString()}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => onLoad(item.id, boxType)}
                  style={{ padding: '4px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                >
                  加载
                </button>
                {boxType !== 'recycle' && onMoveToRecycle && (
                  <button
                    onClick={() => onMoveToRecycle(item.id, item.title, boxType)}
                    style={{ padding: '4px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >
                    移至回收箱
                  </button>
                )}
                {boxType === 'recycle' && onRestore && onPermanentDelete && (
                  <>
                    <button
                      onClick={() => onRestore(item.id, item.title)}
                      style={{ padding: '4px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => onPermanentDelete(item.id, item.title)}
                      style={{ padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      永久删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <button
          onClick={onClose}
          style={{ marginTop: 16, padding: '8px 16px', background: '#64748b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          关闭
        </button>
      </div>
    </div>
  );
};