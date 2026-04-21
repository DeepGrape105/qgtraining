package com.example.brainstorm.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "recycle_box")
public class RecycleBox {
  @Id
  private String id;

  @Column(nullable = false)
  private String title;

  @Column(name = "nodes_json", nullable = false, columnDefinition = "LONGTEXT")
  private String nodesJson;

  @Column(name = "edges_json", nullable = false, columnDefinition = "LONGTEXT")
  private String edgesJson;

  @Column(name = "source_box", nullable = false)
  private String sourceBox;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  @PrePersist
  protected void onCreate() {
    deletedAt = LocalDateTime.now();
  }
}