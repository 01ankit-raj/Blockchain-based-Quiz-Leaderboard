module quiz_leaderboard::leaderboard {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_INVALID_SCORE: u64 = 3;
    const E_ALREADY_CLAIMED: u64 = 4;
    const E_NOT_TOP_PERFORMER: u64 = 5;

    // Score entry structure
    struct ScoreEntry has store, drop, copy {
        player: address,
        score: u64,
        timestamp: u64,
    }

    // Leaderboard resource
    struct Leaderboard has key {
        scores: Table<address, ScoreEntry>,
        all_scores: vector<ScoreEntry>,
        total_participants: u64,
    }

    // Reward tracking
    struct RewardStatus has key {
        has_claimed: bool,
        claim_timestamp: u64,
    }

    /// Initialize the leaderboard (call once by contract deployer)
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        assert!(!exists<Leaderboard>(account_addr), E_ALREADY_INITIALIZED);

        move_to(account, Leaderboard {
            scores: table::new(),
            all_scores: vector::empty<ScoreEntry>(),
            total_participants: 0,
        });
    }

    /// Submit score to the leaderboard
    public entry fun submit_score(account: &signer, score: u64, contract_address: address) acquires Leaderboard {
        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        assert!(score <= 100, E_INVALID_SCORE);

        let player_addr = signer::address_of(account);
        let leaderboard = borrow_global_mut<Leaderboard>(contract_address);
        
        let current_time = timestamp::now_seconds();
        let new_entry = ScoreEntry {
            player: player_addr,
            score,
            timestamp: current_time,
        };

        // Update or insert score
        if (table::contains(&leaderboard.scores, player_addr)) {
            let existing = table::borrow_mut(&mut leaderboard.scores, player_addr);
            // Only update if new score is better
            if (score > existing.score) {
                *existing = new_entry;
                update_all_scores(leaderboard, player_addr, new_entry);
            };
        } else {
            table::add(&mut leaderboard.scores, player_addr, new_entry);
            vector::push_back(&mut leaderboard.all_scores, new_entry);
            leaderboard.total_participants = leaderboard.total_participants + 1;
        };
    }

    /// Helper function to update all_scores vector
    fun update_all_scores(leaderboard: &mut Leaderboard, player: address, new_entry: ScoreEntry) {
        let len = vector::length(&leaderboard.all_scores);
        let i = 0;
        while (i < len) {
            let entry = vector::borrow_mut(&mut leaderboard.all_scores, i);
            if (entry.player == player) {
                *entry = new_entry;
                break
            };
            i = i + 1;
        };
    }

    /// Claim reward for top performer (top 3)
    public entry fun claim_reward(account: &signer, contract_address: address) acquires Leaderboard, RewardStatus {
        let player_addr = signer::address_of(account);
        
        // Check if already claimed
        if (exists<RewardStatus>(player_addr)) {
            let status = borrow_global<RewardStatus>(player_addr);
            assert!(!status.has_claimed, E_ALREADY_CLAIMED);
        };

        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        let leaderboard = borrow_global<Leaderboard>(contract_address);
        
        // Check if player is in top 3
        let is_top_performer = check_top_performer(leaderboard, player_addr);
        assert!(is_top_performer, E_NOT_TOP_PERFORMER);

        // Create or update reward status
        let current_time = timestamp::now_seconds();
        if (!exists<RewardStatus>(player_addr)) {
            move_to(account, RewardStatus {
                has_claimed: true,
                claim_timestamp: current_time,
            });
        } else {
            let status = borrow_global_mut<RewardStatus>(player_addr);
            status.has_claimed = true;
            status.claim_timestamp = current_time;
        };
    }

    /// Check if player is in top 3
    fun check_top_performer(leaderboard: &Leaderboard, player: address): bool {
        let sorted_scores = get_sorted_scores(leaderboard);
        let len = vector::length(&sorted_scores);
        let check_len = if (len > 3) { 3 } else { len };
        
        let i = 0;
        while (i < check_len) {
            let entry = vector::borrow(&sorted_scores, i);
            if (entry.player == player) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Get sorted scores (descending order by score)
    fun get_sorted_scores(leaderboard: &Leaderboard): vector<ScoreEntry> {
        let scores_copy = leaderboard.all_scores;
        let len = vector::length(&scores_copy);
        
        // Bubble sort (sufficient for small datasets)
        let i = 0;
        while (i < len) {
            let j = 0;
            while (j < len - i - 1) {
                let score1 = vector::borrow(&scores_copy, j).score;
                let score2 = vector::borrow(&scores_copy, j + 1).score;
                if (score1 < score2) {
                    vector::swap(&mut scores_copy, j, j + 1);
                };
                j = j + 1;
            };
            i = i + 1;
        };
        scores_copy
    }

    // ==================== VIEW FUNCTIONS ====================

    #[view]
    /// Get a specific player's score and timestamp
    public fun get_player_score(contract_address: address, player: address): (u64, u64) acquires Leaderboard {
        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        let leaderboard = borrow_global<Leaderboard>(contract_address);
        
        if (table::contains(&leaderboard.scores, player)) {
            let entry = table::borrow(&leaderboard.scores, player);
            (entry.score, entry.timestamp)
        } else {
            (0, 0)
        }
    }

    #[view]
    /// Get total number of participants
    public fun get_total_participants(contract_address: address): u64 acquires Leaderboard {
        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        let leaderboard = borrow_global<Leaderboard>(contract_address);
        leaderboard.total_participants
    }

    #[view]
    /// Check if a player has claimed their reward
    public fun has_claimed_reward(player: address): bool acquires RewardStatus {
        if (exists<RewardStatus>(player)) {
            let status = borrow_global<RewardStatus>(player);
            status.has_claimed
        } else {
            false
        }
    }

    #[view]
    /// Get leaderboard entries (returns up to 10 top scores)
    public fun get_leaderboard(contract_address: address): vector<ScoreEntry> acquires Leaderboard {
        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        let leaderboard = borrow_global<Leaderboard>(contract_address);
        get_sorted_scores(leaderboard)
    }

    #[view]
    /// Check if player is in top 3
    public fun is_top_performer(contract_address: address, player: address): bool acquires Leaderboard {
        assert!(exists<Leaderboard>(contract_address), E_NOT_INITIALIZED);
        let leaderboard = borrow_global<Leaderboard>(contract_address);
        check_top_performer(leaderboard, player)
    }
}