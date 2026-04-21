package com.example.brainstorm.repository;

import com.example.brainstorm.entity.BrainstormBox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BrainstormBoxRepository extends JpaRepository<BrainstormBox, String> {
}