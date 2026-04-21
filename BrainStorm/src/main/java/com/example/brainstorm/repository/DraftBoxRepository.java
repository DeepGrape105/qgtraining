package com.example.brainstorm.repository;

import com.example.brainstorm.entity.DraftBox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DraftBoxRepository extends JpaRepository<DraftBox, String> {
}