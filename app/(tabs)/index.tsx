import Button from '@/components/Button';
import ImageViewer from '@/components/ImageViewer';
import { View, StyleSheet } from 'react-native';

const PlaceholderImage = require("../../assets/images/background-image.jpg")

export default function Index() {
  return (
    <View style={styles.container}>

      <View style={styles.imageContainer}>
        <ImageViewer imgSource={PlaceholderImage} />
      </View>

      <View style={styles.footerContainer}>
        <Button label="Manuellement" theme="primary"/>
        <Button label="Automatiquement" />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: "center",
  },

  imageContainer: {
    flex: 1,
  },

  footerContainer: {
    flex: 1 / 3,
    alignItems: 'center',
  },

});
