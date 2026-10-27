package com.portfolio.application;

public record UserAccount(long userId, String email, String passwordHash) {
}
