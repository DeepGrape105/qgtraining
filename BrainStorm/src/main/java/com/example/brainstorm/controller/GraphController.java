package com.example.brainstorm.controller;

import com.example.brainstorm.dto.GraphResponse;
import com.example.brainstorm.dto.MoveToRecycleRequest;
import com.example.brainstorm.dto.SaveGraphRequest;
import com.example.brainstorm.dto.TextAnalyzeRequest;
import com.example.brainstorm.service.GraphService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class GraphController {

    private final GraphService graphService;

    @PostMapping("/save")
    public ResponseEntity<String> save(@RequestBody SaveGraphRequest request) {
        try {
            String id = graphService.save(request);
            return ResponseEntity.ok(id);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Save failed: " + e.getMessage());
        }
    }

    @GetMapping("/load/{id}")
    public ResponseEntity<GraphResponse> load(@PathVariable String id, @RequestParam String boxType) {
        try {
            GraphResponse response = graphService.load(id, boxType);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/list")
    public ResponseEntity<List<GraphResponse>> list(@RequestParam String boxType) {
        try {
            List<GraphResponse> response = graphService.list(boxType);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/moveToRecycle")
    public ResponseEntity<String> moveToRecycle(@RequestBody MoveToRecycleRequest request) {
        try {
            graphService.moveToRecycle(request);
            return ResponseEntity.ok("Moved to recycle");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Move failed: " + e.getMessage());
        }
    }

    @PostMapping("/restoreFromRecycle")
    public ResponseEntity<String> restoreFromRecycle(@RequestBody Map<String, String> request) {
        try {
            graphService.restoreFromRecycle(request.get("id"));
            return ResponseEntity.ok("Restored");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Restore failed: " + e.getMessage());
        }
    }

    @DeleteMapping("/permanentDelete/{id}")
    public ResponseEntity<String> permanentDelete(@PathVariable String id) {
        try {
            graphService.permanentDelete(id);
            return ResponseEntity.ok("Deleted");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Delete failed: " + e.getMessage());
        }
    }

    // 原有的 AI 生成接口
    @GetMapping("/generate")
    public ResponseEntity<GraphResponse> generate(
            @RequestParam String topic,
            @RequestParam(required = false) String parentContext) {
        try {
            GraphResponse response = graphService.generateGraphData(topic, parentContext);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            GraphResponse errorResponse = new GraphResponse();
            errorResponse.setNodes(List.of(Map.of("id", "error", "label", "生成失败: " + e.getMessage())));
            errorResponse.setEdges(List.of());
            return ResponseEntity.ok(errorResponse);
        }
    }

    // 新增：文本分析接口
    @PostMapping("/analyze")
    public ResponseEntity<GraphResponse> analyzeText(@RequestBody TextAnalyzeRequest request) {
        try {
            GraphResponse response = graphService.analyzeText(request.getText());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            GraphResponse errorResponse = new GraphResponse();
            errorResponse.setNodes(List.of(Map.of("id", "error", "label", "分析失败: " + e.getMessage())));
            errorResponse.setEdges(List.of());
            return ResponseEntity.ok(errorResponse);
        }
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<String> update(@PathVariable String id, @RequestBody SaveGraphRequest request) {
        try {
            graphService.update(id, request);
            return ResponseEntity.ok("Updated");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Update failed: " + e.getMessage());
        }
    }
}