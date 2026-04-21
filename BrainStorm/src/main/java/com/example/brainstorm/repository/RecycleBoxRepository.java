package com.example.brainstorm.repository;

import com.example.brainstorm.entity.RecycleBox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecycleBoxRepository extends JpaRepository<RecycleBox, String> {
}