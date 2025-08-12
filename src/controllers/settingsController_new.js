// src/controllers/settingsController.js
const User = require('../models/User');

class SettingsController {
  async getUserProfile(req, res) {
    try {
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user profile without sensitive data
      const profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats,
        apiKeysCount: user.apiKeys.length,
        hasFigmaToken: !!user.figmaToken
      };

      res.json({ profile });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateUserProfile(req, res) {
    try {
      const { profile, preferences } = req.body;
      
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update profile fields
      if (profile) {
        const allowedProfileFields = ['firstName', 'lastName', 'company', 'website', 'bio'];
        allowedProfileFields.forEach(field => {
          if (profile[field] !== undefined) {
            user.profile[field] = profile[field];
          }
        });
      }

      // Update preferences
      if (preferences) {
        const allowedPreferences = ['defaultAiProvider', 'codeStyle', 'theme'];
        allowedPreferences.forEach(field => {
          if (preferences[field] !== undefined) {
            user.preferences[field] = preferences[field];
          }
        });
      }

      await user.save();

      res.json({ 
        success: true, 
        message: 'Profile updated successfully' 
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserStats(req, res) {
    try {
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get additional stats from projects
      const Project = require('../models/Project');
      const projectStats = await Project.aggregate([
        { $match: { userId: req.user.uid } },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            publishedProjects: {
              $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
            },
            totalViews: { $sum: '$analytics.views' },
            totalLikes: { $sum: '$analytics.likes' }
          }
        }
      ]);

      const stats = {
        ...user.stats.toObject(),
        projects: projectStats[0] || {
          totalProjects: 0,
          publishedProjects: 0,
          totalViews: 0,
          totalLikes: 0
        },
        learningPatterns: user.learningData.patterns.length
      };

      res.json({ stats });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getLearningData(req, res) {
    try {
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const learningData = {
        patterns: user.learningData.patterns.slice(0, 20), // Top 20 patterns
        styles: user.learningData.styles.slice(0, 20),
        layouts: user.learningData.layouts.slice(0, 10)
      };

      res.json({ learningData });
    } catch (error) {
      console.error('Error fetching learning data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async clearLearningData(req, res) {
    try {
      const { type } = req.body; // 'patterns', 'styles', 'layouts', or 'all'
      
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (type === 'all') {
        user.learningData = {
          patterns: [],
          styles: [],
          layouts: []
        };
      } else if (user.learningData[type]) {
        user.learningData[type] = [];
      } else {
        return res.status(400).json({ error: 'Invalid learning data type' });
      }

      await user.save();

      res.json({ 
        success: true, 
        message: `${type} learning data cleared successfully` 
      });
    } catch (error) {
      console.error('Error clearing learning data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async exportUserData(req, res) {
    try {
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const Project = require('../models/Project');
      const projects = await Project.find({ userId: req.user.uid })
        .select('-content.html -content.css -content.js'); // Exclude large content

      const exportData = {
        profile: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          profile: user.profile,
          preferences: user.preferences,
          stats: user.stats
        },
        projects: projects.map(p => ({
          id: p._id,
          name: p.name,
          description: p.description,
          status: p.status,
          visibility: p.visibility,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        learningData: user.learningData,
        exportedAt: new Date().toISOString()
      };

      res.json({ exportData });
    } catch (error) {
      console.error('Error exporting user data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteAccount(req, res) {
    try {
      const { confirmEmail } = req.body;
      
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (confirmEmail !== user.email) {
        return res.status(400).json({ error: 'Email confirmation does not match' });
      }

      // Delete all user projects
      const Project = require('../models/Project');
      await Project.deleteMany({ userId: req.user.uid });

      // Delete user account
      await User.findOneAndDelete({ uid: req.user.uid });

      res.json({ 
        success: true, 
        message: 'Account deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new SettingsController();
