package com.example.brainstorm.model;

import java.util.List;

public record GraphResponse(List<GraphNode> nodes, List<GraphEdge> edges) {
}
