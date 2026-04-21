package com.example.brainstorm.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class GraphResponse {
    private String id;
    private String title;
    private List<Map<String, Object>> nodes;
    private List<Map<String, Object>> edges;
    private String createdAt;
}