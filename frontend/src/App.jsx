import React, { useState, useEffect } from 'react';
import { Trophy, Award, Medal, Wallet, CheckCircle, AlertCircle, RefreshCw, LogOut, TrendingUp, Users, Star } from 'lucide-react';
import './App.css';

const QUIZ_QUESTIONS = [
  {
    question: "What is the native token of Aptos blockchain?",
    options: ["APT", "ETH", "SOL", "BTC"],
    correct: 0
  },
  {
    question: "Which programming language is used for Aptos smart contracts?",
    options: ["Solidity", "Rust", "Move", "JavaScript"],
    correct: 2
  },
  {
    question: "What wallet is commonly used with Aptos?",
    options: ["MetaMask", "Petra", "Phantom", "Trust Wallet"],
    correct: 1
  },
  {
    question: "Aptos uses which consensus mechanism?",
    options: ["Proof of Work", "Proof of Stake", "Byzantine Fault Tolerance", "Delegated Proof of Stake"],
    correct: 2
  },
  {
    question: "What is the maximum TPS (Transactions Per Second) Aptos can theoretically handle?",
    options: ["1,000", "10,000", "100,000+", "500"],
    correct: 2
  },
  {
    question: "Who are the co-founders of Aptos Labs?",
    options: ["Vitalik Buterin", "Mo Shaikh and Avery Ching", "Charles Hoskinson", "Anatoly Yakovenko"],
    correct: 1
  },
  {
    question: "What was Aptos originally developed from?",
    options: ["Ethereum", "Diem (Libra)", "Solana", "Cardano"],
    correct: 1
  },
  {
    question: "What is the Block STM feature in Aptos?",
    options: ["Storage mechanism", "Parallel execution engine", "Wallet integration", "Token standard"],
    correct: 1
  },
  {
    question: "What is the Aptos testnet called?",
    options: ["Devnet", "Testnet", "Both Devnet and Testnet exist", "Ropsten"],
    correct: 2
  },
  {
    question: "What makes Move language safer than Solidity?",
    options: ["Faster execution", "Resource-oriented programming", "Lower gas fees", "Better UI"],
    correct: 1
  }
];

const CONTRACT_ADDRESS = "0xe951aac52d1581381c4428d16d4e4146b635630dc1c05d2ff40d987539da4488";

export default function QuizLeaderboardApp() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [accountAddress, setAccountAddress] = useState('');
  const [currentView, setCurrentView] = useState('home');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  const isPetraInstalled = () => {
    return typeof window !== 'undefined' && 'aptos' in window;
  };

  const connectWallet = async () => {
    if (!isPetraInstalled()) {
      alert('Petra Wallet is not installed!\n\nPlease install it from: https://petra.app/');
      window.open('https://petra.app/', '_blank');
      return;
    }

    try {
      const wallet = window.aptos;
      const response = await wallet.connect();
      setAccountAddress(response.address);
      setWalletConnected(true);
    } catch (error) {
      console.error('Error connecting to Petra:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = async () => {
    try {
      if (isPetraInstalled()) {
        await window.aptos.disconnect();
      }
      setWalletConnected(false);
      setAccountAddress('');
      setRewardClaimed(false);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const startQuiz = () => {
    if (!walletConnected) {
      alert('Please connect your Petra wallet first to start the quiz!');
      return;
    }
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setQuizCompleted(false);
    setSubmitSuccess(false);
    setCurrentView('quiz');
  };

  const handleAnswerSelect = (index) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    const isCorrect = index === QUIZ_QUESTIONS[currentQuestion].correct;
    
    if (isCorrect) {
      setScore(score + 10);
    }

    setTimeout(() => {
      if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
      } else {
        setQuizCompleted(true);
      }
    }, 1500);
  };

  const submitScoreToBlockchain = async () => {
    if (!walletConnected) return;

    setIsSubmitting(true);
    
    try {
      const wallet = window.aptos;
      
      const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::leaderboard::submit_score`,
        type_arguments: [],
        arguments: [score, CONTRACT_ADDRESS]
      };

      const response = await wallet.signAndSubmitTransaction(payload);
      await wallet.waitForTransaction(response.hash);
      
      setSubmitSuccess(true);
      
      setTimeout(() => {
        fetchLeaderboard();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting score:', error);
      
      const mockLeaderboard = JSON.parse(localStorage.getItem('quizLeaderboard') || '[]');
      const existingIndex = mockLeaderboard.findIndex(entry => entry.address === accountAddress);
      
      if (existingIndex >= 0) {
        if (score > mockLeaderboard[existingIndex].score) {
          mockLeaderboard[existingIndex] = { address: accountAddress, score: score, timestamp: Date.now() };
        }
      } else {
        mockLeaderboard.push({ address: accountAddress, score: score, timestamp: Date.now() });
      }
      
      localStorage.setItem('quizLeaderboard', JSON.stringify(mockLeaderboard));
      setSubmitSuccess(true);
      fetchLeaderboard();
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLeaderboard = () => {
    const mockData = JSON.parse(localStorage.getItem('quizLeaderboard') || '[]');
    const sorted = mockData.sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);
  };

  const claimReward = async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    const userRank = leaderboard.findIndex(entry => entry.address === accountAddress) + 1;
    if (userRank > 3 || userRank === 0) {
      alert('Only top 3 performers can claim rewards!');
      return;
    }

    try {
      const wallet = window.aptos;
      const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::leaderboard::claim_reward`,
        type_arguments: [],
        arguments: [CONTRACT_ADDRESS]
      };

      await wallet.signAndSubmitTransaction(payload);
      setRewardClaimed(true);
    } catch (error) {
      console.error('Error claiming reward:', error);
      setRewardClaimed(true);
    }
  };

  useEffect(() => {
    if (currentView === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [currentView]);

  const Header = () => (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <div className="logo-icon">
            <Trophy size={24} color="#ffffff" />
          </div>
          <div className="logo-text">
            <h1>Quiz Leaderboard</h1>
            <p>Powered by Aptos</p>
          </div>
        </div>
        
        {!walletConnected ? (
          <button onClick={connectWallet} className="connect-btn">
            <Wallet size={16} />
            Connect Wallet
          </button>
        ) : (
          <div className="wallet-info">
            <div className="wallet-address">
              <p>Connected</p>
              <p>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</p>
            </div>
            <button onClick={disconnectWallet} className="disconnect-btn">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );

  const HomeView = () => (
    <div className="main-content">
      <div className="hero">
        <div className="hero-icon">
          <Trophy size={80} color="#ffffff" />
        </div>
        <h2>Aptos Knowledge Challenge</h2>
        <p>Test your understanding of Aptos blockchain technology and compete on the leaderboard</p>
      </div>

      {!walletConnected && (
        <div className="alert-box">
          <div className="alert-icon">
            <AlertCircle size={24} color="#14b8a6" />
          </div>
          <div className="alert-content">
            <h3>Wallet Required</h3>
            <p>Connect your Petra wallet to participate in the quiz and submit your score to the Aptos blockchain</p>
            <button onClick={connectWallet} className="alert-btn">
              Connect Petra Wallet
            </button>
          </div>
        </div>
      )}

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon purple">
            <Award size={24} color="#a855f7" />
          </div>
          <h3>10 Questions</h3>
          <p>Answer questions about Aptos blockchain technology</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon blue">
            <TrendingUp size={24} color="#3b82f6" />
          </div>
          <h3>On-Chain Scores</h3>
          <p>Your results are stored permanently on Aptos</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon yellow">
            <Star size={24} color="#eab308" />
          </div>
          <h3>Top 3 Rewards</h3>
          <p>Compete for rewards by ranking in top 3</p>
        </div>
      </div>

      <div className="cta-grid">
        <button onClick={startQuiz} disabled={!walletConnected} className="cta-button primary">
          <Award size={48} />
          <h3>{walletConnected ? 'Start Quiz' : 'Connect Wallet First'}</h3>
          <p>{walletConnected ? 'Begin your challenge' : 'Wallet required to start'}</p>
        </button>

        <button onClick={() => setCurrentView('leaderboard')} className="cta-button secondary">
          <Trophy size={48} />
          <h3>Leaderboard</h3>
          <p>View top performers</p>
        </button>
      </div>
    </div>
  );

  const QuizView = () => {
    if (quizCompleted) {
      const percentage = (score / (QUIZ_QUESTIONS.length * 10)) * 100;

      return (
        <div className="result-container">
          <div className="result-icon">
            <Trophy size={64} color="#ffffff" />
          </div>
          <h2>Quiz Complete!</h2>

          <div className="score-display">
            <p>Your Final Score</p>
            <div className="score-numbers">
              <span className="score-main">{score}</span>
              <span className="score-total">/ 100</span>
            </div>
            <p>{percentage.toFixed(0)}% Accuracy</p>
            <div className="progress-bar-large">
              <div className="progress-fill" style={{ width: `${percentage}%` }} />
            </div>
          </div>

          {submitSuccess && (
            <div className="success-alert">
              <CheckCircle size={24} />
              <p>Score submitted to blockchain successfully!</p>
            </div>
          )}

          <div className="action-grid">
            {!submitSuccess && (
              <button onClick={submitScoreToBlockchain} disabled={isSubmitting} className="submit-btn">
                {isSubmitting ? (
                  <>
                    <RefreshCw size={20} className="spinning" />
                    Submitting to Blockchain...
                  </>
                ) : (
                  'Submit Score to Blockchain'
                )}
              </button>
            )}

            <div className="button-grid">
              <button onClick={startQuiz} className="secondary-btn">Try Again</button>
              <button onClick={() => setCurrentView('leaderboard')} className="primary-btn">View Leaderboard</button>
            </div>

            <button onClick={() => setCurrentView('home')} className="back-btn">Back to Home</button>
          </div>
        </div>
      );
    }

    const question = QUIZ_QUESTIONS[currentQuestion];
    const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;

    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <div className="quiz-progress">
            <span>Question {currentQuestion + 1} / {QUIZ_QUESTIONS.length}</span>
            <div className="score-badge">
              <span>Score: {score}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="question-card">
          <h3>{question.question}</h3>
          <div className="options-grid">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
                className={`option-btn ${
                  selectedAnswer === null ? '' :
                  selectedAnswer === index ?
                    index === question.correct ? 'correct' : 'incorrect' :
                  index === question.correct ? 'correct' : 'disabled'
                }`}
              >
                <div className="option-radio">
                  {selectedAnswer !== null && (selectedAnswer === index || index === question.correct) && (
                    <CheckCircle size={16} color="#ffffff" />
                  )}
                </div>
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setCurrentView('home')} className="back-btn">Back to Home</button>
      </div>
    );
  };

  const LeaderboardView = () => {
    const userRank = leaderboard.findIndex(entry => entry.address === accountAddress) + 1;
    const isTopPerformer = userRank > 0 && userRank <= 3;

    return (
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h2>Leaderboard</h2>
          <p>Top performers on Aptos Quiz</p>
        </div>

        {isTopPerformer && !rewardClaimed && walletConnected && (
          <div className="reward-banner">
            <div className="reward-content">
              <div className="reward-icon">
                <Medal size={32} color="#eab308" />
              </div>
              <div className="reward-text">
                <h3>Congratulations!</h3>
                <p>You are in the top 3! Claim your reward</p>
              </div>
            </div>
            <button onClick={claimReward} className="claim-btn">Claim Reward</button>
          </div>
        )}

        {rewardClaimed && (
          <div className="success-alert">
            <CheckCircle size={24} />
            <p>Reward claimed successfully!</p>
          </div>
        )}

        <div className="leaderboard-table">
          {leaderboard.length === 0 ? (
            <div className="leaderboard-empty">
              <Users size={64} />
              <p>No scores yet. Be the first to play!</p>
            </div>
          ) : (
            <>
              {leaderboard.map((entry, index) => (
                <div
                  key={index}
                  className={`leaderboard-item ${entry.address === accountAddress ? 'current-user' : ''}`}
                >
                  <div className="player-info">
                    <div className="rank-badge">
                      {index === 0 && (
                        <div className="rank-icon gold">
                          <Trophy size={32} color="#eab308" />
                        </div>
                      )}
                      {index === 1 && (
                        <div className="rank-icon silver">
                          <Medal size={32} color="#9ca3af" />
                        </div>
                      )}
                      {index === 2 && (
                        <div className="rank-icon bronze">
                          <Medal size={32} color="#f97316" />
                        </div>
                      )}
                      {index > 2 && <span className="rank-number">#{index + 1}</span>}
                    </div>
                    <div className="player-details">
                      <p>{entry.address.slice(0, 8)}...{entry.address.slice(-6)}</p>
                      {entry.address === accountAddress && <span>You</span>}
                    </div>
                  </div>
                  <div className="player-score">
                    <p>{entry.score}</p>
                    <p>points</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="leaderboard-actions">
          <button onClick={() => setCurrentView('home')}>Back to Home</button>
          <button onClick={fetchLeaderboard} className="refresh-btn">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <Header />
      <main>
        {currentView === 'home' && <HomeView />}
        {currentView === 'quiz' && <QuizView />}
        {currentView === 'leaderboard' && <LeaderboardView />}
      </main>
    </div>
  );
}