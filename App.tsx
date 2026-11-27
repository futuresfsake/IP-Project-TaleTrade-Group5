import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getAuth, onAuthStateChanged, onIdTokenChanged, FirebaseAuthTypes } from '@react-native-firebase/auth';

import { AuthNavigator } from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import PickAGenreScreen from './src/screens/PickAGenreScreen';
import GenreDetailScreen from './src/screens/GenreDetailScreen';
import BookDetailScreen from './src/screens/BookDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SearchScreen from './src/screens/SearchScreen';
import MapScreen from './src/screens/map/MapScreen';
import CreateListingScreen from './src/screens/feed/CreateListingScreen';
import { DialogHost } from './src/component/ui/AppDialog';
import ChooseSpotsScreen from './src/screens/feed/ChooseSpotsScreen';

// Development-only warning banner: hide the map library's own style notices.
LogBox?.ignoreLogs(['MapLibre Native']);

const RootStack = createNativeStackNavigator();

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const auth = getAuth();

    const authSubscriber = onAuthStateChanged(auth, (userState) => {
      setUser(userState);
      if (initializing) setInitializing(false);
    });

    const userSubscriber = onIdTokenChanged(auth, (userState) => {
      if (userState) setUser(userState);
    });

    return () => {
      authSubscriber();
      userSubscriber();
    };
  }, [initializing]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63A8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          !user.displayName ? (
            <RootStack.Screen 
              name="Onboarding" 
              component={PickAGenreScreen} 
              key="onboarding-screen"
            />
          ) : (
            <>
              <RootStack.Screen 
                name="AppTabs" 
                component={TabNavigator} 
                key="main-app-tabs"
              />
              
              <RootStack.Screen 
                name="UserProfileView" 
                component={ProfileScreen}
                key="user-profile-view"
              />

              {/* UPDATED: Dynamic Title based on Genre Name */}
              <RootStack.Screen 
                name="GenreDetail" 
                component={GenreDetailScreen} 
                key="genre-detail-screen"
              />

              {/* Opened from the search bar on Home */}
              <RootStack.Screen
                name="Search"
                component={SearchScreen}
                key="search-screen"
              />

              {/* Opened from Home, Book Detail and Feed posts */}
              <RootStack.Screen
                name="Map"
                component={MapScreen}
                key="meetup-map-screen"
              />

              <RootStack.Screen
                name="CreateListing"
                component={CreateListingScreen}
                key="create-listing-screen"
              />

              <RootStack.Screen
                name="ChooseSpots"
                component={ChooseSpotsScreen}
                key="choose-spots-screen"
              />

              <RootStack.Screen
                name="BookDetail"
                component={BookDetailScreen}
                key="book-detail-screen"
              />
            </>
          )
        ) : (
          <RootStack.Screen 
            name="Auth" 
            component={AuthNavigator} 
            key="auth-stack"
          />
        )}
      </RootStack.Navigator>
      <DialogHost />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, 
    backgroundColor: '#F5E9CF', 
    justifyContent: 'center', 
    alignItems: 'center'
  }
});

export default App;