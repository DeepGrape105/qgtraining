import { useState, useRef, useEffect } from 'react';
import { EdgeLabelRenderer, getBezierPath } from 'reactflow';

interface CustomEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data: { label?: string };
  markerEnd?: string;
  selected?: boolean;
  source: string;
  target: string;
}

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
  source,
  target,
}: CustomEdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [labelText, setLabelText] = useState(data?.label || '');
  const [isLabelSelected, setIsLabelSelected] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 监听外部标签更新
  useEffect(() => {
    setLabelText(data?.label || '');
  }, [data?.label]);

  // 监听键盘删除事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isLabelSelected && labelText) {
        e.preventDefault();
        setLabelText('');
        window.dispatchEvent(new CustomEvent('update-edge-label', { detail: { edgeId: id, label: '' } }));
        setIsLabelSelected(false);
        window.dispatchEvent(new CustomEvent('label-deselected'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLabelSelected, labelText, id]);

  const getLabelRotation = () => {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle > 90 || angle < -90) {
      angle += 180;
    }
    return angle;
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };

  // 点击边时触发选中
  const handleEdgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('clear-edge-selection'));
    window.dispatchEvent(new CustomEvent('edge-selected', { detail: { edgeId: id } }));
  };

  const handleAddLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLabel = prompt('请输入两个节点之间的关系', '');
    if (newLabel !== null && newLabel.trim()) {
      setLabelText(newLabel.trim());
      window.dispatchEvent(new CustomEvent('update-edge-label', { detail: { edgeId: id, label: newLabel.trim() } }));
    }
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLabelSelected(!isLabelSelected);
    if (!isLabelSelected) {
      window.dispatchEvent(new CustomEvent('clear-edge-selection'));
    }
  };

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLabel = prompt('编辑关系描述', labelText);
    if (newLabel !== null && newLabel.trim() === '') {
      setLabelText('');
      window.dispatchEvent(new CustomEvent('update-edge-label', { detail: { edgeId: id, label: '' } }));
    } else if (newLabel !== null && newLabel.trim()) {
      setLabelText(newLabel.trim());
      window.dispatchEvent(new CustomEvent('update-edge-label', { detail: { edgeId: id, label: newLabel.trim() } }));
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.edge-label')) {
        setIsLabelSelected(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const startReconnectSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('edge-reconnect-start', {
      detail: { edgeId: id, end: 'source' }
    }));
  };

  const startReconnectTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('edge-reconnect-start', {
      detail: { edgeId: id, end: 'target' }
    }));
  };

  const rotation = getLabelRotation();
  const showHandles = isHovered || selected;

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const finalLabelX = (labelX && isFinite(labelX) && labelX !== 0) ? labelX : midX;
  const finalLabelY = (labelY && isFinite(labelY) && labelY !== 0) ? labelY : midY;

  // 苹果风格颜色
  const defaultColor = '#8E8E93';  // iOS 系统灰
  const hoverColor = '#007AFF';     // iOS 蓝色
  const selectedColor = '#FF9F0A';  // iOS 橙色

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={{
          stroke: selected ? selectedColor : (isHovered ? hoverColor : defaultColor),
          strokeWidth: selected ? 2.5 : (isHovered ? 2.5 : 2),
          strokeDasharray: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
        markerEnd={markerEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleEdgeClick}
      />

      {/* 源端点拖拽把手 */}
      {showHandles && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              left: sourceX - 6,
              top: sourceY - 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: selected ? selectedColor : (isHovered ? hoverColor : defaultColor),
              border: '2px solid white',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 1000,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease',
            }}
            onMouseDown={startReconnectSource}
          />
        </EdgeLabelRenderer>
      )}

      {/* 目标端点拖拽把手 */}
      {showHandles && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              left: targetX - 6,
              top: targetY - 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: selected ? selectedColor : (isHovered ? hoverColor : defaultColor),
              border: '2px solid white',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 1000,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease',
            }}
            onMouseDown={startReconnectTarget}
          />
        </EdgeLabelRenderer>
      )}

      {/* 加号按钮 - 悬停时显示 */}
      {isHovered && !labelText && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              left: finalLabelX - 7,
              top: finalLabelY - 7,
              pointerEvents: 'auto',
              zIndex: 10000,
            }}
          >
            <div
              onClick={handleAddLabel}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#34C759',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
              onMouseEnter={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsHovered(true);
              }}
              onMouseLeave={() => {
                timeoutRef.current = setTimeout(() => {
                  setIsHovered(false);
                }, 300);
              }}
            >
              +
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* 标签文字 - 超小 */}
      {labelText && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              position: 'absolute',
              left: finalLabelX,
              top: finalLabelY,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              pointerEvents: 'auto',
              zIndex: 1000,
            }}
          >
            <div
              onClick={handleLabelClick}
              onDoubleClick={handleLabelDoubleClick}
              style={{
                background: isLabelSelected ? selectedColor : (isHovered ? '#f0f0f0' : 'white'),
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 9,
                fontWeight: 500,
                color: isLabelSelected ? 'white' : '#3A3A3C',
                border: `1px solid ${isLabelSelected ? selectedColor : '#D1D1D6'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                transition: 'all 0.2s ease',
              }}
            >
              {labelText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};