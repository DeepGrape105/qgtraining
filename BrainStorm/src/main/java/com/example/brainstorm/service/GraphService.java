package com.example.brainstorm.service;

import com.example.brainstorm.dto.GraphResponse;
import com.example.brainstorm.dto.MoveToRecycleRequest;
import com.example.brainstorm.dto.SaveGraphRequest;
import com.example.brainstorm.entity.BrainstormBox;
import com.example.brainstorm.entity.DraftBox;
import com.example.brainstorm.entity.RecycleBox;
import com.example.brainstorm.repository.BrainstormBoxRepository;
import com.example.brainstorm.repository.DraftBoxRepository;
import com.example.brainstorm.repository.RecycleBoxRepository;
import com.example.brainstorm.config.SiliconFlowConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

@Service
@RequiredArgsConstructor
public class GraphService {

    private final BrainstormBoxRepository brainstormBoxRepository;
    private final DraftBoxRepository draftBoxRepository;
    private final RecycleBoxRepository recycleBoxRepository;
    private final SiliconFlowConfig siliconFlowConfig;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    // ==================== CRUD 方法（保持不变）====================

    @Transactional
    public String save(SaveGraphRequest request) throws Exception {
        String id = UUID.randomUUID().toString();
        String nodesJson = objectMapper.writeValueAsString(request.getNodes());
        String edgesJson = objectMapper.writeValueAsString(request.getEdges());

        switch (request.getBoxType()) {
            case "brainstorm":
                BrainstormBox brainstorm = new BrainstormBox();
                brainstorm.setId(id);
                brainstorm.setTitle(request.getTitle());
                brainstorm.setNodesJson(nodesJson);
                brainstorm.setEdgesJson(edgesJson);
                brainstormBoxRepository.save(brainstorm);
                break;
            case "draft":
                DraftBox draft = new DraftBox();
                draft.setId(id);
                draft.setTitle(request.getTitle());
                draft.setNodesJson(nodesJson);
                draft.setEdgesJson(edgesJson);
                draftBoxRepository.save(draft);
                break;
            default:
                throw new IllegalArgumentException("Unknown box type: " + request.getBoxType());
        }
        return id;
    }

    @Transactional(readOnly = true)
    public GraphResponse load(String id, String boxType) throws Exception {
        String nodesJson = null;
        String edgesJson = null;
        String title = null;
        String createdAt = null;

        switch (boxType) {
            case "brainstorm":
                Optional<BrainstormBox> brainstorm = brainstormBoxRepository.findById(id);
                if (brainstorm.isPresent()) {
                    nodesJson = brainstorm.get().getNodesJson();
                    edgesJson = brainstorm.get().getEdgesJson();
                    title = brainstorm.get().getTitle();
                    createdAt = brainstorm.get().getCreatedAt().toString();
                }
                break;
            case "draft":
                Optional<DraftBox> draft = draftBoxRepository.findById(id);
                if (draft.isPresent()) {
                    nodesJson = draft.get().getNodesJson();
                    edgesJson = draft.get().getEdgesJson();
                    title = draft.get().getTitle();
                    createdAt = draft.get().getCreatedAt().toString();
                }
                break;
            case "recycle":
                Optional<RecycleBox> recycle = recycleBoxRepository.findById(id);
                if (recycle.isPresent()) {
                    nodesJson = recycle.get().getNodesJson();
                    edgesJson = recycle.get().getEdgesJson();
                    title = recycle.get().getTitle();
                    createdAt = recycle.get().getDeletedAt().toString();
                }
                break;
        }

        if (nodesJson == null) {
            throw new RuntimeException("Graph not found");
        }

        GraphResponse response = new GraphResponse();
        response.setId(id);
        response.setTitle(title);
        response.setNodes(objectMapper.readValue(nodesJson, List.class));
        response.setEdges(objectMapper.readValue(edgesJson, List.class));
        response.setCreatedAt(createdAt);
        return response;
    }

    @Transactional(readOnly = true)
    public List<GraphResponse> list(String boxType) throws Exception {
        List<GraphResponse> result = new ArrayList<>();

        switch (boxType) {
            case "brainstorm":
                for (BrainstormBox item : brainstormBoxRepository.findAll()) {
                    GraphResponse resp = new GraphResponse();
                    resp.setId(item.getId());
                    resp.setTitle(item.getTitle());
                    resp.setCreatedAt(item.getCreatedAt().toString());
                    result.add(resp);
                }
                break;
            case "draft":
                for (DraftBox item : draftBoxRepository.findAll()) {
                    GraphResponse resp = new GraphResponse();
                    resp.setId(item.getId());
                    resp.setTitle(item.getTitle());
                    resp.setCreatedAt(item.getCreatedAt().toString());
                    result.add(resp);
                }
                break;
            case "recycle":
                for (RecycleBox item : recycleBoxRepository.findAll()) {
                    GraphResponse resp = new GraphResponse();
                    resp.setId(item.getId());
                    resp.setTitle(item.getTitle());
                    resp.setCreatedAt(item.getDeletedAt().toString());
                    result.add(resp);
                }
                break;
        }
        return result;
    }

    @Transactional
    public void moveToRecycle(MoveToRecycleRequest request) throws Exception {
        String nodesJson = null;
        String edgesJson = null;

        switch (request.getBoxType()) {
            case "brainstorm":
                Optional<BrainstormBox> brainstorm = brainstormBoxRepository.findById(request.getId());
                if (brainstorm.isPresent()) {
                    nodesJson = brainstorm.get().getNodesJson();
                    edgesJson = brainstorm.get().getEdgesJson();
                    brainstormBoxRepository.delete(brainstorm.get());
                }
                break;
            case "draft":
                Optional<DraftBox> draft = draftBoxRepository.findById(request.getId());
                if (draft.isPresent()) {
                    nodesJson = draft.get().getNodesJson();
                    edgesJson = draft.get().getEdgesJson();
                    draftBoxRepository.delete(draft.get());
                }
                break;
        }

        if (nodesJson != null) {
            RecycleBox recycle = new RecycleBox();
            recycle.setId(request.getId());
            recycle.setTitle(request.getTitle());
            recycle.setNodesJson(nodesJson);
            recycle.setEdgesJson(edgesJson);
            recycle.setSourceBox(request.getBoxType());
            recycleBoxRepository.save(recycle);
        }
    }

    @Transactional
    public void restoreFromRecycle(String id) throws Exception {
        Optional<RecycleBox> recycle = recycleBoxRepository.findById(id);
        if (recycle.isEmpty()) {
            throw new RuntimeException("Recycle item not found");
        }

        if ("brainstorm".equals(recycle.get().getSourceBox())) {
            BrainstormBox brainstorm = new BrainstormBox();
            brainstorm.setId(recycle.get().getId());
            brainstorm.setTitle(recycle.get().getTitle());
            brainstorm.setNodesJson(recycle.get().getNodesJson());
            brainstorm.setEdgesJson(recycle.get().getEdgesJson());
            brainstormBoxRepository.save(brainstorm);
        } else {
            DraftBox draft = new DraftBox();
            draft.setId(recycle.get().getId());
            draft.setTitle(recycle.get().getTitle());
            draft.setNodesJson(recycle.get().getNodesJson());
            draft.setEdgesJson(recycle.get().getEdgesJson());
            draftBoxRepository.save(draft);
        }

        recycleBoxRepository.delete(recycle.get());
    }

    @Transactional
    public void permanentDelete(String id) {
        recycleBoxRepository.deleteById(id);
    }

    @Transactional
    public void update(String id, SaveGraphRequest request) throws Exception {
        String nodesJson = objectMapper.writeValueAsString(request.getNodes());
        String edgesJson = objectMapper.writeValueAsString(request.getEdges());

        switch (request.getBoxType()) {
            case "brainstorm":
                BrainstormBox brainstorm = brainstormBoxRepository.findById(id)
                        .orElseThrow(() -> new RuntimeException("Brainstorm box item not found: " + id));
                brainstorm.setTitle(request.getTitle());
                brainstorm.setNodesJson(nodesJson);
                brainstorm.setEdgesJson(edgesJson);
                // 注意：这里是 save，但因为 id 已存在，所以是更新，不是新建
                brainstormBoxRepository.save(brainstorm);
                break;
            case "draft":
                DraftBox draft = draftBoxRepository.findById(id)
                        .orElseThrow(() -> new RuntimeException("Draft box item not found: " + id));
                draft.setTitle(request.getTitle());
                draft.setNodesJson(nodesJson);
                draft.setEdgesJson(edgesJson);
                draftBoxRepository.save(draft);
                break;
            default:
                throw new IllegalArgumentException("Unknown box type: " + request.getBoxType());
        }
    }

    // ==================== AI 生成知识图谱 ====================

    public GraphResponse generateGraphData(String topic, String parentContext) {
        try {
            String prompt;
            if (parentContext != null && !parentContext.isEmpty()) {
                prompt = String.format(
                        "扩展知识图谱。主题：「%s」，要扩展的节点：「%s」。\n" +
                                "请生成 %s 的 3-6 个子概念，并给出准确的关系描述。\n\n" +
                                "输出格式：\n" +
                                "{\n" +
                                "  \"nodes\": [{\"id\":\"唯一ID\", \"label\":\"子概念名\"}],\n" +
                                "  \"edges\": [{\"source\":\"父ID\", \"target\":\"子ID\", \"label\":\"关系\"}]\n" +
                                "}\n只返回JSON：",
                        topic, parentContext, parentContext);
            } else {
                // 检测是否包含多个主题
                // 支持空格、中文逗号、英文逗号、顿号
                boolean isMultipleTopics = topic.contains(" ") || topic.contains("、") || topic.contains(",")
                        || topic.contains("，");
                String instruction;

                if (isMultipleTopics) {
                    instruction = String.format(
                            "你是一个知识图谱专家。请分析以下多个主题之间的关联关系，生成一个统一的知识图谱。\n\n" +
                                    "主题列表：%s\n\n" +
                                    "要求：\n" +
                                    "1. 提取每个主题的核心概念\n" +
                                    "2. 分析这些主题之间的关联关系（如：包含、并列、对比、依赖等）\n" +
                                    "3. 生成一个完整的、有联系的知识网络，而不是独立的几个子图\n" +
                                    "4. 节点数量控制在 8-15 个\n\n" +
                                    "输出格式：\n" +
                                    "{\n" +
                                    "  \"nodes\": [{\"id\":\"1\", \"label\":\"概念1\"}, {\"id\":\"2\", \"label\":\"概念2\"}],\n"
                                    +
                                    "  \"edges\": [{\"source\":\"1\", \"target\":\"2\", \"label\":\"关系\"}]\n" +
                                    "}\n只返回JSON：",
                            topic);
                } else {
                    instruction = String.format(
                            "为主题「%s」生成知识图谱。\n" +
                                    "提取核心概念和它们之间的关系，关系描述要简洁准确。\n\n" +
                                    "输出格式：\n" +
                                    "{\n" +
                                    "  \"nodes\": [{\"id\":\"1\", \"label\":\"概念名\"}],\n" +
                                    "  \"edges\": [{\"source\":\"1\", \"target\":\"2\", \"label\":\"关系\"}]\n" +
                                    "}\n只返回JSON：",
                            topic);
                }
                prompt = instruction;
            }

            String response = callSiliconFlowAPI(prompt);
            String jsonContent = extractJsonFromResponse(response);
            return objectMapper.readValue(jsonContent, GraphResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            return getMockGraphData(topic, parentContext);
        }
    }

    // 调用硅基流动 API
    private String callSiliconFlowAPI(String userPrompt) throws Exception {
        String systemPrompt = "你是知识图谱专家。只输出JSON，关系标签必须精准简洁，禁止使用「相关」「关联」等模糊词。";

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", siliconFlowConfig.getModel());
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)));
        requestBody.put("stream", false);
        requestBody.put("temperature", 0.2);
        requestBody.put("max_tokens", 2000);

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(siliconFlowConfig.getApiUrl()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + siliconFlowConfig.getApiKey())
                .timeout(java.time.Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String responseBody = response.body();

        JsonNode jsonResponse = objectMapper.readTree(responseBody);

        if (jsonResponse.has("error")) {
            String errorMsg = jsonResponse.get("error").get("message").asText();
            throw new RuntimeException("API Error: " + errorMsg);
        }

        return jsonResponse.get("choices").get(0).get("message").get("content").asText();
    }

    // 提取JSON内容
    private String extractJsonFromResponse(String response) {
        response = response.trim();
        if (response.startsWith("{") && response.endsWith("}")) {
            return response;
        }
        Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
        Matcher matcher = pattern.matcher(response);
        if (matcher.find()) {
            return matcher.group();
        }
        return response;
    }

    // Mock数据
    private GraphResponse getMockGraphData(String topic, String parentContext) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        if (parentContext != null && !parentContext.isEmpty()) {
            String prefix = "ext_" + System.currentTimeMillis() + "_";
            for (int i = 1; i <= 3; i++) {
                Map<String, Object> node = new HashMap<>();
                node.put("id", prefix + i);
                node.put("label", parentContext + " - 细节" + i);
                nodes.add(node);

                Map<String, Object> edge = new HashMap<>();
                edge.put("id", prefix + "e" + i);
                edge.put("source", "1");
                edge.put("target", prefix + i);
                edge.put("label", "包含");
                edges.add(edge);
            }
        } else {
            Map<String, Object> node1 = new HashMap<>();
            node1.put("id", "1");
            node1.put("label", topic);
            nodes.add(node1);

            for (int i = 2; i <= 4; i++) {
                Map<String, Object> node = new HashMap<>();
                node.put("id", String.valueOf(i));
                node.put("label", topic + " - 子概念" + (i - 1));
                nodes.add(node);

                Map<String, Object> edge = new HashMap<>();
                edge.put("id", "e" + (i - 1));
                edge.put("source", "1");
                edge.put("target", String.valueOf(i));
                edge.put("label", "包含");
                edges.add(edge);
            }
        }

        GraphResponse response = new GraphResponse();
        response.setNodes(nodes);
        response.setEdges(edges);
        return response;
    }

    private String buildGenerationPrompt(String topic, String parentContext) {
        if (parentContext != null && !parentContext.isEmpty()) {
            return String.format("""
                    你是知识图谱专家。请为「%s」扩展子概念。

                    待扩展节点：%s

                    要求：
                    1. 生成3-6个子概念
                    2. 关系标签使用2-6个汉字，如：包含、依赖、组成、实现、分支、子集、属于
                    3. 禁止在关系标签中使用：是、的、了、着、过

                    输出纯JSON，格式如下：
                    {"nodes":[{"id":"新ID","label":"子概念名"}],"edges":[{"source":"%s","target":"新ID","label":"关系词"}]}

                    直接输出JSON：
                    """, topic, parentContext, parentContext);
        } else {
            return String.format("""
                    你是知识图谱专家。请为主题「%s」生成初始知识图谱。

                    要求：
                    1. 提取4-8个核心概念作为节点
                    2. 关系标签使用2-6个汉字，如：包含、依赖、组成、实现、分支、子集、属于
                    3. 禁止在关系标签中使用：是、的、了、着、过

                    输出纯JSON，格式如下：
                    {"nodes":[{"id":"1","label":"概念名"}],"edges":[{"source":"1","target":"2","label":"关系词"}]}

                    直接输出JSON：
                    """, topic);
        }
    }

    // ==================== 文本分析（核心方法）====================

    public GraphResponse analyzeText(String text) throws Exception {
        System.out.println("=== 开始分析文本 ===");
        System.out.println("输入文本: " + text);

        try {
            String prompt = buildAnalysisPrompt(text);
            System.out.println("提示词:\n" + prompt);

            String response = callAPI(prompt);
            System.out.println("API 原始响应:\n" + response);

            String json = extractJson(response);
            System.out.println("提取的JSON:\n" + json);

            GraphResponse result = parseResponse(json);

            // 只做最基本的格式清理，不修改语义
            result = formatOnly(result);

            printResult(result);
            return result;

        } catch (Exception e) {
            System.err.println("API 调用失败: " + e.getMessage());
            e.printStackTrace();
            return ruleBasedExtract(text);
        }
    }

    /**
     * 核心提示词 - 引导模型进行正确的语义理解
     */
    private String buildAnalysisPrompt(String text) {
        return """
                你是一位知识图谱构建专家。请仔细分析以下文本，提取所有概念和它们之间的语义关系。

                【文本内容】
                %s

                【语义理解规则 - 请特别注意】

                1. 被动语态识别：
                   - 「A是由B开发的C」表示：B是开发者，A是被开发的产品，C是A的类型
                   - 正确的关系应该是：B → A (开发)，A → C (实质)
                   - 例如：「React是由Facebook开发的JavaScript库」
                     正确输出：Facebook → React (开发)，React → JavaScript库 (实质)

                2. 用途关系识别：
                   - 「A用于B」表示：A的用途是B
                   - 正确的关系应该是：A → B (用于)
                   - 例如：「State用于管理组件数据」
                     正确输出：State → 管理组件数据 (用于)

                3. 归属关系识别：
                   - 「A是B的C」表示：A属于B，关系类型是C
                   - 正确的关系应该是：A → B (C)
                   - 例如：「组件是React的核心概念」
                     正确输出：组件 → React (核心概念)

                4. 提供关系识别：
                   - 「A提供了B」表示：A提供B功能
                   - 正确的关系应该是：A → B (提供)
                   - 例如：「Eureka提供了服务注册功能」
                     正确输出：Eureka → 服务注册功能 (提供)

                5. 分类关系识别：
                   - 「A分为B和C」表示：A包含B和C两种类型
                   - 正确的关系应该是：A → B (包含)，A → C (包含)
                   - 例如：「组件分为函数组件和类组件」
                     正确输出：组件 → 函数组件 (包含)，组件 → 类组件 (包含)

                【输出格式】
                请输出纯JSON格式，不要有任何额外解释文字：
                {
                  "nodes": [
                    {"id": "1", "label": "概念名称"},
                    {"id": "2", "label": "另一个概念"}
                  ],
                  "edges": [
                    {"source": "1", "target": "2", "label": "关系类型"}
                  ]
                }

                【关系标签要求】
                - 长度：2-6个汉字
                - 不要包含：是、的、了、着、过、与、和、及
                - 使用准确的动词或名词短语

                请开始分析：
                """.formatted(text);
    }

    /**
     * API 调用
     */
    private String callAPI(String userPrompt) throws Exception {
        String systemPrompt = """
                你是一位知识图谱专家，精通中文语义分析。

                核心能力：
                - 准确识别被动语态（「由」「被」）
                - 准确识别用途关系（「用于」「用来」）
                - 准确识别归属关系（「是...的」）
                - 准确识别关系方向

                输出要求：
                - 只输出JSON格式
                - 不做任何解释说明
                """;

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", siliconFlowConfig.getModel());
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)));
        requestBody.put("stream", false);
        requestBody.put("temperature", 0.1);
        requestBody.put("max_tokens", 4000);

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(siliconFlowConfig.getApiUrl()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + siliconFlowConfig.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String responseBody = response.body();

        JsonNode jsonResponse = objectMapper.readTree(responseBody);
        return jsonResponse.get("choices").get(0).get("message").get("content").asText();
    }

    /**
     * 提取JSON
     */
    private String extractJson(String response) {
        if (response == null || response.isEmpty())
            return "{}";

        response = response.trim();

        // 移除markdown代码块
        response = response.replaceAll("(?i)^```json\\s*", "");
        response = response.replaceAll("(?i)^```\\s*", "");
        response = response.replaceAll("\\s*```$", "");

        // 找到第一个 { 和最后一个 }
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');

        if (start >= 0 && end > start) {
            return response.substring(start, end + 1);
        }

        return response;
    }

    /**
     * 解析JSON响应
     */
    private GraphResponse parseResponse(String jsonContent) throws Exception {
        GraphResponse result = new GraphResponse();
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        JsonNode root = objectMapper.readTree(jsonContent);

        JsonNode nodesNode = root.get("nodes");
        if (nodesNode != null && nodesNode.isArray()) {
            for (JsonNode node : nodesNode) {
                Map<String, Object> nodeMap = new HashMap<>();
                String id = node.has("id") ? node.get("id").asText() : UUID.randomUUID().toString();
                String label = node.has("label") ? node.get("label").asText() : "未知";
                nodeMap.put("id", id);
                nodeMap.put("label", label.trim());
                nodes.add(nodeMap);
            }
        }

        JsonNode edgesNode = root.get("edges");
        if (edgesNode != null && edgesNode.isArray()) {
            for (JsonNode edge : edgesNode) {
                if (edge.has("source") && edge.has("target") && edge.has("label")) {
                    Map<String, Object> edgeMap = new HashMap<>();
                    edgeMap.put("source", edge.get("source").asText());
                    edgeMap.put("target", edge.get("target").asText());
                    edgeMap.put("label", edge.get("label").asText());
                    edges.add(edgeMap);
                }
            }
        }

        result.setNodes(nodes);
        result.setEdges(edges);
        return result;
    }

    /**
     * 只做格式清理，不改变语义
     */
    private GraphResponse formatOnly(GraphResponse response) {
        List<Map<String, Object>> nodes = response.getNodes();
        List<Map<String, Object>> edges = response.getEdges();

        if (nodes == null)
            nodes = new ArrayList<>();
        if (edges == null)
            edges = new ArrayList<>();

        // 收集有效节点ID
        Set<String> validNodeIds = new HashSet<>();
        for (Map<String, Object> node : nodes) {
            Object id = node.get("id");
            if (id != null) {
                validNodeIds.add(id.toString());
            }
        }

        // 只过滤无效边，不改标签内容
        List<Map<String, Object>> validEdges = new ArrayList<>();
        Set<String> edgeKeys = new HashSet<>();

        for (Map<String, Object> edge : edges) {
            Object source = edge.get("source");
            Object target = edge.get("target");
            Object label = edge.get("label");

            if (source == null || target == null || label == null)
                continue;

            String sourceStr = source.toString();
            String targetStr = target.toString();
            String labelStr = label.toString().trim();

            // 验证节点存在
            if (!validNodeIds.contains(sourceStr) || !validNodeIds.contains(targetStr)) {
                System.out.println("跳过无效边（节点不存在）: " + sourceStr + " -> " + targetStr);
                continue;
            }

            // 跳过自环
            if (sourceStr.equals(targetStr)) {
                System.out.println("跳过自环: " + sourceStr + " -> " + targetStr);
                continue;
            }

            // 去重
            String key = sourceStr + "|" + targetStr + "|" + labelStr;
            if (!edgeKeys.contains(key)) {
                edgeKeys.add(key);
                validEdges.add(edge);
            }
        }

        response.setEdges(validEdges);
        return response;
    }

    /**
     * 规则提取（兜底方案）
     */
    private GraphResponse ruleBasedExtract(String text) {
        System.out.println("使用规则引擎兜底");

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Map<String, String> labelToId = new HashMap<>();
        Set<String> edgeKeys = new HashSet<>();

        String[] sentences = text.split("[。！？]");

        for (String sentence : sentences) {
            sentence = sentence.trim();
            if (sentence.isEmpty())
                continue;

            // 1. 被动语态：A是由B开发的C
            int shiYou = sentence.indexOf("是由");
            int kaiFa = sentence.indexOf("开发", shiYou > 0 ? shiYou : 0);

            if (shiYou > 0 && kaiFa > shiYou) {
                String product = sentence.substring(0, shiYou).trim().replaceAll("^是", "");
                String developer = sentence.substring(shiYou + 2, kaiFa).trim();
                String type = sentence.substring(kaiFa + 2).trim().replaceAll("^的", "");

                int comma = type.indexOf('，');
                if (comma > 0)
                    type = type.substring(0, comma);

                if (!product.isEmpty() && !developer.isEmpty() && !type.isEmpty()) {
                    String devId = getOrCreateNode(developer, labelToId, nodes);
                    String prodId = getOrCreateNode(product, labelToId, nodes);
                    String typeId = getOrCreateNode(type, labelToId, nodes);

                    addEdge(devId, prodId, "开发", edges, edgeKeys);
                    addEdge(prodId, typeId, "实质", edges, edgeKeys);

                    System.out.println("规则提取: " + developer + " → " + product + " (开发)");
                    System.out.println("规则提取: " + product + " → " + type + " (实质)");
                }
            }

            // 2. 用途关系：用于X的Y
            int yongYu = sentence.indexOf("用于");
            int de = sentence.indexOf("的", yongYu > 0 ? yongYu : 0);

            if (yongYu >= 0 && de > yongYu) {
                String purpose = sentence.substring(yongYu + 2, de).trim();
                String entity = sentence.substring(de + 1).trim();

                int comma = entity.indexOf('，');
                if (comma > 0)
                    entity = entity.substring(0, comma);

                // 找主语
                int shi = sentence.indexOf("是");
                if (shi >= 0 && shi < yongYu) {
                    String subject = sentence.substring(0, shi).trim().replaceAll("^是", "");

                    if (!subject.isEmpty() && !purpose.isEmpty()) {
                        String subjId = getOrCreateNode(subject, labelToId, nodes);
                        String purpId = getOrCreateNode(purpose, labelToId, nodes);
                        String entId = getOrCreateNode(entity, labelToId, nodes);

                        addEdge(subjId, purpId, "用于", edges, edgeKeys);
                        addEdge(subjId, entId, "实质", edges, edgeKeys);

                        System.out.println("规则提取: " + subject + " → " + purpose + " (用于)");
                    }
                }
            }
        }

        GraphResponse response = new GraphResponse();
        response.setNodes(nodes);
        response.setEdges(edges);
        return response;
    }

    private String getOrCreateNode(String label, Map<String, String> labelToId, List<Map<String, Object>> nodes) {
        if (labelToId.containsKey(label)) {
            return labelToId.get(label);
        }

        String id = String.valueOf(nodes.size() + 1);
        Map<String, Object> node = new HashMap<>();
        node.put("id", id);
        node.put("label", label);
        nodes.add(node);
        labelToId.put(label, id);

        return id;
    }

    private void addEdge(String source, String target, String label,
            List<Map<String, Object>> edges, Set<String> edgeKeys) {
        if (source.equals(target))
            return;

        String key = source + "|" + target + "|" + label;
        if (!edgeKeys.contains(key)) {
            Map<String, Object> edge = new HashMap<>();
            edge.put("source", source);
            edge.put("target", target);
            edge.put("label", label);
            edges.add(edge);
            edgeKeys.add(key);
        }
    }

    private void printResult(GraphResponse response) {
        Map<String, String> idToLabel = new HashMap<>();
        for (Map<String, Object> node : response.getNodes()) {
            idToLabel.put(node.get("id").toString(), node.get("label").toString());
        }

        System.out.println("\n========== 知识图谱结果 ==========");
        System.out.println("节点 (" + response.getNodes().size() + "个):");
        for (Map.Entry<String, String> e : idToLabel.entrySet()) {
            System.out.println("  " + e.getKey() + ": " + e.getValue());
        }
        System.out.println("\n关系 (" + response.getEdges().size() + "条):");
        for (Map<String, Object> edge : response.getEdges()) {
            String s = idToLabel.get(edge.get("source").toString());
            String t = idToLabel.get(edge.get("target").toString());
            String l = edge.get("label").toString();
            System.out.println("  " + s + " → " + t + " : " + l);
        }
        System.out.println("==================================\n");
    }

    // ==================== Mock 数据 ====================

    private GraphResponse getMockData(String topic, String parentContext) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        if (parentContext != null && !parentContext.isEmpty()) {
            for (int i = 1; i <= 3; i++) {
                Map<String, Object> node = new HashMap<>();
                node.put("id", "ext_" + i);
                node.put("label", parentContext + "相关" + i);
                nodes.add(node);

                Map<String, Object> edge = new HashMap<>();
                edge.put("source", "1");
                edge.put("target", "ext_" + i);
                edge.put("label", "包含");
                edges.add(edge);
            }
        } else {
            Map<String, Object> node1 = new HashMap<>();
            node1.put("id", "1");
            node1.put("label", topic);
            nodes.add(node1);

            for (int i = 2; i <= 4; i++) {
                Map<String, Object> node = new HashMap<>();
                node.put("id", String.valueOf(i));
                node.put("label", topic + "概念" + (i - 1));
                nodes.add(node);

                Map<String, Object> edge = new HashMap<>();
                edge.put("source", "1");
                edge.put("target", String.valueOf(i));
                edge.put("label", "包含");
                edges.add(edge);
            }
        }

        GraphResponse response = new GraphResponse();
        response.setNodes(nodes);
        response.setEdges(edges);
        return response;
    }
}