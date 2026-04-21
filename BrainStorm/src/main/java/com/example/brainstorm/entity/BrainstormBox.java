package com.example.brainstorm.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "brainstorm_box")
public class BrainstormBox {
    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(name = "nodes_json", nullable = false, columnDefinition = "LONGTEXT")
    private String nodesJson;

    @Column(name = "edges_json", nullable = false, columnDefinition = "LONGTEXT")
    private String edgesJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}