package com.example.brainstorm.dto;

import lombok.Data;

@Data
public class MoveToRecycleRequest {
    private String id;
    private String boxType;
    private String title;
}