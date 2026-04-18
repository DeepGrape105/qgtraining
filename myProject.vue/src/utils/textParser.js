export function parseRichText(html, defaultColor, defaultSize, defaultWeight, defaultFamily) {
  const segments = [];

  // 创建一个临时 DOM 元素来解析 HTML
  const div = document.createElement('div');
  div.innerHTML = html;

  // 递归遍历 DOM 节点
  function processNode(node, parentStyles = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        segments.push({
          text: text,
          ...parentStyles
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const styles = { ...parentStyles };

      // 计算当前节点的样式
      const computedStyle = {};

      // 检查 style 属性
      const styleAttr = node.getAttribute('style');
      if (styleAttr) {
        const colorMatch = styleAttr.match(/color:\s*([^;]+)/);
        if (colorMatch) computedStyle.color = colorMatch[1];

        const bgMatch = styleAttr.match(/background-color:\s*([^;]+)/);
        if (bgMatch) computedStyle.backgroundColor = bgMatch[1];
      }

      // 处理标签
      if (tagName === 'strong' || tagName === 'b') {
        styles.bold = true;
      }
      if (tagName === 'em' || tagName === 'i') {
        styles.italic = true;
      }
      if (tagName === 'u') {
        styles.underline = true;
      }
      if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
        styles.strike = true;
      }
      if (tagName === 'mark') {
        styles.backgroundColor = computedStyle.backgroundColor || '#ffff00';
      }
      if (tagName === 'span') {
        // span 通常用于携带颜色样式
        if (computedStyle.color) styles.color = computedStyle.color;
        if (computedStyle.backgroundColor) styles.backgroundColor = computedStyle.backgroundColor;
      }

      // 确保默认值
      styles.color = styles.color || defaultColor;
      styles.fontSize = styles.fontSize || defaultSize;
      styles.fontWeight = styles.fontWeight || defaultWeight;
      styles.fontFamily = styles.fontFamily || defaultFamily;

      // 递归处理子节点
      node.childNodes.forEach(child => processNode(child, styles));
    }
  }

  processNode(div, {
    color: defaultColor,
    fontSize: defaultSize,
    fontWeight: defaultWeight,
    fontFamily: defaultFamily,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    backgroundColor: null
  });

  return segments;
}